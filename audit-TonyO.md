commit 5c78149213f14ed7df93c2b7a95669d549ff8dcc

## issue-1

**[High]** Attacker can forcibly send ether to the account resulting in a miscalculation of campaign contributions.

On line 97 of /contracts/Crownfunding.sol has the following code:
  
  `if (address(this).balance >= goal)`

Due to the selfdestruct method, an attacker can forcibly send you ether. This can be potentially be used by a creator to inflate the project balance and trigger a state change in order to propel a slowing down project to a successful state and hide their direct involvement.

Consider: Introducing a state variable "projectBalance" that you can manally update in the withdraw, refund and contribute methods. If the contract receives funds from outside of the contribute method, one would be able to easily notice a discrepancy in contract balance vs 'projectBalance'. https://solidity-by-example.org/hacks/self-destruct/

## issue-2

**[Low]** 

Lines 165, 169, 173, 177, 181, 185, 189 of /contracts/Crownfunding.sol has the following code:

  `revert();`

Compiler Warning: Warning: Unused function parameter. Remove or comment out the variable name to silence this warning.

Consider: Remove `revert()`. This was used for the unimplemented ERC721 methods. The use of `revert()` is unnecessary as it consumes gas and the function don't require any implementation if they are unsupported.


## issue-3

**[Code-Quality]** Transfer event not required.

On line 27 of /contracts/Crownfunding.sol has the following code:

  event Transfer(address from, address to, uint tokenId);

The solution specification does not call for any transfer functionality. Thus, this event is not required.

## issue-4

**[Code-Quality]** 

On line 114 of /contracts/Crownfunding.sol has the following code:

  uint remove = (address(this).balance / 100) * percentage;

Literal interpretation of the requirements.

Consider: While the contract explicity called for the ability to withdraw by percentage, the same can be easily supported by allowing the creator/owner to withdraw funds using `msg.value`. If `msg.value` is below the contract balance then they should be able to withdraw the exact funds they require in ether. They can keep doing so until the funds are at zero.




