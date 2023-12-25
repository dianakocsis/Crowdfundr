// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "../../contracts/Project.sol";

contract ReentrancyAttempt {
    Project public victimProject;

    bool attackInitiated;

    constructor(Project _project) {
        victimProject = _project;
    }

    function attack() public payable {
        victimProject.contribute{value: msg.value}();
        victimProject.claim(address(this));
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual returns (bytes4) {
        if (!attackInitiated) {
            attackInitiated = true;
            victimProject.claim(address(this));
        }

        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }
}