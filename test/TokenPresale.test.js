import ether from 'openzeppelin-solidity/test/helpers/ether';
import { advanceBlock } from 'openzeppelin-solidity/test/helpers/advanceToBlock';
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'openzeppelin-solidity/test/helpers/latestTime';
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const Token = artifacts.require("./Token")
const TokenPresale = artifacts.require("./TokenPresale");

contract('TokenPresaleTest', function (accounts) {
  let wallet = accounts[0];
  let investor0 = accounts[1];
  let investor1 = accounts[2];

  let rate = 130000;
  let cap = 636363637e18;

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.days(10);
    this.token = await Token.new();
    this.presale = await TokenPresale.new(this.token.address, wallet, rate, this.openingTime, this.closingTime, cap);
    await this.token.transferOwnership(this.presale.address);
  });

  describe('purchasing tokens', function() {
    it('should not accept payments beforen presale opening time', async function() {
      await increaseTimeTo(latestTime());
      await this.presale.addToWhitelist(investor1);
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should accept payments during presale', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.presale.addToWhitelist(investor0);
       await this.presale.buyTokens(investor0, {from: investor0, value: ether(1) }).should.be.fulfilled;
    });
    it('should reject payments during presale if not whitelisted', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.presale.buyTokens(investor0, {from: investor0, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should not allow buy tokens if all presale tokens bought presale not finished yet', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor0);
      await this.presale.addToWhitelist(investor1);
      await this.presale.buyTokens(investor0, {from: investor0, value: ether(5000) }).should.be.fulfilled;
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should not accept payments after closing time', async function() {
       await increaseTimeTo(this.closingTime + duration.weeks(1));
       await this.presale.addToWhitelist(investor1);
       await this.presale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should buy correct amount of tokens in the presale', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor1);
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(rate*1e18);
    });
    it('should forward funds to wallet after purchase during the presale', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor1);
      var amount = ether(1);
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.presale.buyTokens(investor1, {from: investor1, value: amount }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      let diff = postPurchaseBalance.minus(prePurchaseBalance);
      diff.should.be.bignumber.gt(ether(0.9));
      diff.should.be.bignumber.lt(ether(1.1));
    });
    it('should return funds to investor when too much eth was sent for all presale tokens', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor1);
      const prePurchaseBalance = web3.eth.getBalance(investor1);
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(5000) }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(investor1);
      let diff = prePurchaseBalance.minus(postPurchaseBalance);
      diff.should.be.bignumber.gt(ether(4895));
      diff.should.be.bignumber.lt(ether(4896));
    });
    it('should mint tokens while purchasing during presale', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor1);
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(1)}).should.be.fulfilled;
      let totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(130000e18);
    });
  });

  describe('finalization and tokens distribution', function() {
    it('should not allow finalize before closing time and tokens not sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.finalize().should.be.rejectedWith(EVMRevert);
    });
    it('should allow finalize after closing time and tokens not sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.presale.finalize().should.be.fulfilled;
    });
    it('should allow finalize before closing time and tokens are sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor1);
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(5000) }).should.be.fulfilled;
      await this.presale.finalize().should.be.fulfilled;
    });
    it('should transfer ownership when finallized', async function () {
      const ownerBefore = await this.token.owner();
      ownerBefore.should.be.equal(this.presale.address);
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.presale.finalize().should.be.fulfilled;
      const ownerAfter = await this.token.owner();
      ownerAfter.should.be.equal(wallet);
    });
    it('should not finish minting when finalized presale', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.presale.finalize().should.be.fulfilled;
      let mintingFinished = await this.token.mintingFinished();
      mintingFinished.should.be.equal(false);
    });
    it('should not mint any more tokens when presale finalized', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.presale.addToWhitelist(investor1);
      await this.presale.buyTokens(investor1, {from: investor1, value: ether(1)}).should.be.fulfilled;
      let totalSupplyBefore = await this.token.totalSupply();
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      let totalSupplyAfter = await this.token.totalSupply();
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
    });
  });
});
