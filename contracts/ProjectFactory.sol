// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "./Project.sol";

contract ProjectFactory {

    event ProjectCreated();

    /// @notice Creates a new Project contract
    /// @param _goal The goal of the project
    /// @param _name The name of the project
    /// @param _symbol The symbol of the project
    /// @return The address of the new Project contract
    function create(uint256 _goal, string calldata _name, string calldata _symbol) external returns (address) {
        Project project = new Project(msg.sender, _goal, _name, _symbol);
        emit ProjectCreated();
        return address(project);
    }
}
