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
const TokenSale = artifacts.require("./TokenSale");


contract('TokenSaleTest', function (accounts) {
  let wallet = accounts[0];
  let investor0 = accounts[3];
  let investor1 = accounts[4];

  let saleRates = [new BigNumber(120000), new BigNumber(110000), new BigNumber(100000)];
  let saleCaps = [new BigNumber(775252526e18), new BigNumber(906831473e18), new BigNumber(1056831473e18)];

  let phaseLengthInDays = 10;

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.days(30);

    this.token = await Token.new();
    this.sale = await TokenSale.new(this.token.address, wallet, saleRates, saleCaps, this.openingTime, this.closingTime);
    await this.token.transferOwnership(this.sale.address);

  });

  describe('purchasing tokens', function() {
    it('should not accept payments beforen sale opening time', async function() {
      await increaseTimeTo(latestTime());
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should accept payments during sale', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.sale.addAddressToWhitelist(investor0);
       await this.sale.buyTokens(investor0, {from: investor0, value: ether(1) }).should.be.fulfilled;
    });
    it('should reject payments during sale if not whitelisted', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.sale.buyTokens(investor0, {from: investor0, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should not allow buy tokens if all sale tokens bought presale not finished yet', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.sale.addAddressToWhitelist(investor0);
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor0, {from: investor0, value: ether(11000) }).should.be.fulfilled;
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should set phaseLength correctly', async function() {
      let phaseLength = await this.sale.phaseLength();
      phaseLength.should.be.bignumber.equal(duration.days(10));
    });
    it('should set cap correctly', async function() {
      let cap = await this.sale.cap();
      cap.should.be.bignumber.equal(ether(1056831473));
    });
    it('should not accept payments after closing time', async function() {
       await increaseTimeTo(this.closingTime + duration.weeks(1));
       await this.sale.addAddressToWhitelist(investor1);
       await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should buy correct amount of tokens in the sale 1 phase', async function() {
      await increaseTimeTo(this.openingTime + duration.days(1));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(saleRates[0]*1e18);
    });
    it('should buy correct amount of tokens in the sale 2 phase', async function() {
      await increaseTimeTo(this.openingTime + duration.days(1));
      await this.sale.addAddressToWhitelist(investor0);
      await this.sale.buyTokens(investor0, {from: investor0, value: ether(6500) }).should.be.fulfilled;
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(saleRates[1]*1e18);
    });
    it('should buy correct amount of tokens in the sale 3 phase', async function() {
      await increaseTimeTo(this.openingTime + duration.days(1));
      await this.sale.addAddressToWhitelist(investor0);
      await this.sale.buyTokens(investor0, {from: investor0, value: ether(8300) }).should.be.fulfilled;
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(saleRates[2]*1e18);
    });
    it('should buy correct amount of tokens in the sale 1 phase by date', async function() {
      await increaseTimeTo(this.openingTime + duration.days(1));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(saleRates[0]*1e18);
    });
    it('should buy correct amount of tokens in the sale 2 phase by date', async function() {
      await increaseTimeTo(this.openingTime + duration.days(11));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(saleRates[1]*1e18);
    });
    it('should buy correct amount of tokens in the sale 3 phase by date', async function() {
      await increaseTimeTo(this.openingTime + duration.days(21));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(saleRates[2]*1e18);
    });
    it('should not allow buy tokens after the 3 phase by date', async function() {
      await increaseTimeTo(this.openingTime + duration.days(31));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should forward funds to wallet after purchase during the sale', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.sale.addAddressToWhitelist(investor1);
      var amount = ether(1);
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.sale.buyTokens(investor1, {from: investor1, value: amount }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      let diff = postPurchaseBalance.minus(prePurchaseBalance);
      diff.should.be.bignumber.gt(ether(0.9));
      diff.should.be.bignumber.lt(ether(1.1));
    });
    it('should return funds to investor when too much eth was sent for all sale tokens', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.sale.addAddressToWhitelist(investor1);
      const prePurchaseBalance = web3.eth.getBalance(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(15000) }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(investor1);
      let diff = prePurchaseBalance.minus(postPurchaseBalance);
      diff.should.be.bignumber.gt(ether(9156));
      diff.should.be.bignumber.lt(ether(9157));
    });
   it('should mint  tokens while purchasing during sale', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(1)}).should.be.fulfilled;
      let totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(120000e18);
    });
  });

  describe('finalization and tokens distribution', function() {
    it('should not allow finalize before closing time and tokens not sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.sale.finalize().should.be.rejectedWith(EVMRevert);
    });
    it('should allow finalize after closing time and tokens not sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.sale.finalize().should.be.fulfilled;
    });
    it('should allow finalize before closing time and tokens are sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.sale.addAddressToWhitelist(investor1);
      await this.sale.buyTokens(investor1, {from: investor1, value: ether(15000) }).should.be.fulfilled;
      await this.sale.finalize().should.be.fulfilled;
    });
    it('should transfer ownership when finallized', async function () {
      const ownerBefore = await this.token.owner();
      ownerBefore.should.be.equal(this.sale.address);
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.sale.finalize().should.be.fulfilled;
      const ownerAfter = await this.token.owner();
      ownerAfter.should.be.equal(wallet);
    });
    it('should finish minting when finalized sale', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.sale.finalize().should.be.fulfilled;
      let mintingFinished = await this.token.mintingFinished();
      mintingFinished.should.be.equal(true);
    });
    it('should burn all leftover tokens when sale finalized', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.sale.finalize().should.be.fulfilled;
      let totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(0);
    });
    it('should not allow finalize when finalized', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.sale.finalize().should.be.fulfilled;
      await this.sale.finalize().should.be.rejectedWith(EVMRevert);
    });
  });
});
