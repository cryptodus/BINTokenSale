pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import './Token.sol';

contract TokenPresale is MintedCrowdsale, TimedCrowdsale, WhitelistedCrowdsale {
    using SafeMath for uint256;

    uint256 public cap;

    uint256 public overflowWei;

    constructor(
        Token _token,
        address _wallet,
        uint256 _rate,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _cap
    )
    public
        Crowdsale(_rate, _wallet, _token)
        TimedCrowdsale(_openingTime, _closingTime) {

        require(_cap > 0);
        cap = _cap;
    }

    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
      super._preValidatePurchase(_beneficiary, _weiAmount);
      require(cap < token.totalSupply());
    }

    function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
      uint256 _currentSupply = token.totalSupply();
      if (_currentSupply.add(_tokenAmount) > cap) {
        _tokenAmount = cap.sub(_currentSupply);
      }
      super._processPurchase(_beneficiary, _tokenAmount);
      uint256 _weiAmount = _tokenAmount.div(rate);

      require(_weiAmount <= msg.value);
      uint256 _weiToReturn = msg.value.sub(_weiAmount);
      weiRaised = weiRaised.sub(_weiToReturn);
      overflowWei = _weiToReturn;
      _beneficiary.transfer(_weiToReturn);
    }

    function _forwardFunds() internal {
      wallet.transfer(msg.value.sub(overflowWei));
      overflowWei = 0;
    }

    function finalization() internal {
      Token _token = Token(token);
      _token.transferOwnership(wallet);
    }
}
