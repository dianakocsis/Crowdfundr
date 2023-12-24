// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Project.sol";

contract Crowdfunding {
    
    event Register(address creator, string title, uint goal);

    Project[] public registeredProjects;
    
    /// @notice Registering a project and adding it to array
    /// @param goal Creator of project gets to set goal
    function registerProject(string memory title, uint goal) external {
        Project newProject = new Project(msg.sender, title, goal);
        registeredProjects.push(newProject);
        emit Register(msg.sender, title, goal);
    }
    
    /// @notice Returns array of Projects
    function getRegisteredProjects() external view returns (Project[] memory) {
        return registeredProjects;
    }
}
