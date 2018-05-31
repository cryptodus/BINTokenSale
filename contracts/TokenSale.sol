pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import './Token.sol';

contract TokenSale is MintedCrowdsale, FinalizableCrowdsale, WhitelistedCrowdsale {
  using SafeMath for uint256;

  uint256 public cap;
  uint256[] public rates;
  uint256[] public capsTo;
  uint256 public phaseLength;

  uint256 public phase = 0;

  uint256 public overflowWei;

  constructor(
      Token _token,
      address _wallet,
      uint256 _cap,
      uint256[] _rates,
      uint256[] _capsTo,
      uint256 _openingTime,
      uint256 _phaseLength
  )
      public
      Crowdsale(_rates[0], _wallet, _token)
      TimedCrowdsale(_openingTime, _openingTime.add(_phaseLength.mul(1 days)))
  {
     require(_rates.length > 0);
     require(_rates.length == _capsTo.length);

     require(_cap > 0);

     require(_phaseLength > 0);

     cap = _cap;
     rates = _rates;
     capsTo = _capsTo;
     phaseLength = _phaseLength;
   }

  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    if (now > closingTime && phase < rates.length) {
      uint256 _phasesPassed = (now.sub(closingTime)).div(phaseLength.mul(1 days));
      closingTime = closingTime.add(phaseLength.mul(1 days));
      phase = phase.add(_phasesPassed);
    }
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(token.totalSupply() < cap);
    require(phase < rates.length);
  }

  function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    _tokenAmount = 0;
    uint256 _weiSpent = 0;
    uint256 _weiAmount = msg.value;

    uint256 _currentSupply = token.totalSupply();
    uint256 _tokensForRate = 0;
    uint256 _weiReq = 0;

    // while we can purchase all tokens in current cap-rate step, move to other step
    while (_weiAmount > 0 && phase < rates.length) {
      _tokensForRate = capsTo[phase].sub(_currentSupply);
      _weiReq = _tokensForRate.div(rates[phase]);
      if (_weiReq > _weiAmount) {
        // if wei required is more or equal than we have - we can purchase only part of the cap-rate step tokens
         _tokensForRate = _weiAmount.mul(rates[phase]);
         _weiReq = _weiAmount;
      }

      _weiSpent = _weiSpent.add(_weiReq);
      _weiAmount = _weiAmount.sub(_weiReq);
      _tokenAmount = _tokenAmount.add(_tokensForRate);
      _currentSupply = token.totalSupply().add(_tokenAmount);
      phase = phase.add(1);
      closingTime.add(phaseLength.mul(1 days));
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
  Method open-zeppelin override, we need to sub if any wei was returned
  */
  function _forwardFunds() internal {
    wallet.transfer(msg.value.sub(overflowWei));
    overflowWei = 0;
  }

  /*
 OpenZeppelin FinalizableCrowdsale method override - token distribution
 and finishing routines
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
}
