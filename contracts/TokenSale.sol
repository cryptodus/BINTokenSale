pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import './Token.sol';

contract TokenSale is MintedCrowdsale, FinalizableCrowdsale, WhitelistedCrowdsale {

  constructor(
      Token _token,
      address _wallet,
      uint256 _phaseLength,
      uint256 _cap,
      uint256[] _rates,
      uint256[] _capsTo,
      uint256 _openingTime,
      uint256 _closingTime
  )
      public
      Crowdsale(_rates[0], _wallet, _token)
      TimedCrowdsale(_openingTime, _closingTime)
  {
     require(_rates.length > 0);
     require(_rates.length == _capsTo.length);

     require(_closingTime <= _openingTime);
     require(now() >= _openingTime);

     require(_cap > 0);
  }

}
