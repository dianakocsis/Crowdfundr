Theo Telonis

https://github.com/dlk61/Crowdfundr

The following is a micro audit of git commit 7e1fddb05960d93f3506cb33f71434d5a3e1092b

Comments: 
Overall great work! You kept the logic and state very tight leaving no surface area for attacks.
Nice use of modifiers and events!

## issue-1

**[Medium]** Line #114: Performs a multiplication on the result of a division:
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#divide-before-multiply


##  Nitpicks / Code Quality

 - If you were to deploy this you would want to eventually delete line #3 (console import)

 - Line #43 minimumContribution should be a constant variable

 - Line 134 is unnessescary, solidity does the address(0) check under the hood