pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import './Token.sol';

/*
  Constract handling public token sale. Sale price changes in steps depending on amount sold
  and time passed.
*/
contract TokenSale is MintedCrowdsale, FinalizableCrowdsale, WhitelistedCrowdsale {
  using SafeMath for uint256;

  // total ico cap
  uint256 public cap;

  // step rates - token prices with discounts for each phase
  uint256[] public rates;

  // token caps for each phase
  uint256[] public caps;

  // phase lenth in seconds - calculated automatically in consturctor
  uint256 public phaseLength;

  // helper param - current phase counter
  uint256 public phase = 0;

  // parameter for storing overflowWei of the last investor if sent too much eth
  uint256 public overflowWei;

  constructor(
      Token _token,
      address _wallet,
      uint256[] _rates,
      uint256[] _caps,
      uint256 _openingTime,
      uint256 _closingTime
  )
      public
      Crowdsale(_rates[0], _wallet, _token)
      TimedCrowdsale(_openingTime, _closingTime)
  {
     require(_rates.length > 0);
     require(_rates.length == _caps.length);
     rates = _rates;
     caps = _caps;

     cap = _caps[_caps.length.sub(1)];
     require(cap > 0);

     // phase length depends on total duration of ico and phases count
     phaseLength = _closingTime.sub(_openingTime).div(_rates.length);

     // closing time is changed once current phase ends
     closingTime = openingTime.add(phaseLength);
   }

   /*
    OpenZeppelin method override for handling phases changing in time - setting new closing time
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    while (now > closingTime && phase < rates.length) {
       phase = phase.add(1);
       closingTime = closingTime.add(phaseLength);
    }
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(token.totalSupply() < cap);
    require(phase < rates.length);
  }

  /*
   OpenZeppelin method override for handling purchase and phases changing depending on the amount bought
  */
  function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    _tokenAmount = 0;
    uint256 _weiSpent = 0;
    uint256 _weiAmount = msg.value;

    uint256 _currentSupply = token.totalSupply();
    uint256 _tokensForRate = 0;
    uint256 _weiReq = 0;

    // while we can purchase all tokens in current cap-rate step, move to other step
    while (_weiAmount > 0 && phase < rates.length) {
      _tokensForRate = caps[phase].sub(token.totalSupply()).sub(_tokenAmount);
      _weiReq = _tokensForRate.div(rates[phase]);
      if (_weiReq > _weiAmount) {
        // if wei required is more or equal than we have - we can purchase only part of the cap-rate step tokens
         _tokensForRate = _weiAmount.mul(rates[phase]);
         _weiReq = _weiAmount;
      } else {
        // if we afford to buy more than there are in current phase move to next phase
        phase = phase.add(1);
        closingTime = closingTime.add(phaseLength);
      }

      _weiSpent = _weiSpent.add(_weiReq);
      _weiAmount = _weiAmount.sub(_weiReq);
      _tokenAmount = _tokenAmount.add(_tokensForRate);
    }

    super._processPurchase(_beneficiary, _tokenAmount);
    _processFundsOverflow(_beneficiary, _weiSpent);
  }

  /*
    In either stage last beneficiary can send more ethers than there are tokens
    to purchase - in this case overflow ethers are returned to beneficiary
  */
  function _processFundsOverflow(address _beneficiary, uint256 _weiAmount) internal {
    require(_weiAmount <= msg.value);
    uint256 _weiToReturn = msg.value.sub(_weiAmount);
    weiRaised = weiRaised.sub(_weiToReturn);
    overflowWei = _weiToReturn;
    _beneficiary.transfer(_weiToReturn);
  }

  /*
    Method OpenZeppelin override, we need to sub if any wei was returned
  */
  function _forwardFunds() internal {
    wallet.transfer(msg.value.sub(overflowWei));
    overflowWei = 0;
  }

  /*
   OpenZeppelin override - burn all leftover tokens finish minting and return ownership
  */
  function finalization() internal {
    Token _token = Token(token);

    uint256 _tokensToBurn = _token.cap().sub(_token.totalSupply());
    require(_token.mint(address(this), _tokensToBurn));
    _token.burn(_tokensToBurn);

    require(_token.finishMinting());
    _token.transferOwnership(wallet);

    super.finalization();
  }

  /*
    OpenZeppelin method override for checking if total ico cap reached.
  */
  function hasClosed() public view returns (bool) {
    Token _token = Token(token);
    bool _soldOut = _token.totalSupply() >= cap;
    return super.hasClosed() || _soldOut;
  }
}
