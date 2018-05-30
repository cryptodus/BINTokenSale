pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/token/ERC20/CappedToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol';


/*
  Token is PausableToken and on the creation it is paused.
  It is made so because you don't want token to be transferable etc,
  while your ico is not over.
*/
contract Token is CappedToken, PausableToken, BurnableToken {

  uint256 private constant TOKEN_CAP = 1056831473 * 10**18;

  string public constant name = "BIN token";
  string public constant symbol = "BIN";
  uint8 public constant decimals = 18;

  constructor() public CappedToken(TOKEN_CAP) {
    paused = true;
  }
}
