# BINTokenSale

There are three stages of ICO:
private presale - handled manually - tokens distributed before public presale
public presale - handled by TokenPresale.sol provide cap upto for all presale.
public sale - handled by TokenSale.sol provide multiple steped capps upto for ico.
              last upto cap should be total ico cap (both presales included) - so
              if in one of the sale phases do not reach it's goal - the other phase
              simply has more tokens to sell.

NOTE: public presale and public sale contracts are separate and has no association with each other -
      so if required any of those two can be skipped
