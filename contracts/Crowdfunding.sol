// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "hardhat/console.sol";

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

contract Project {

    event Transfer(address from, address to, uint tokenId);
    event Success(string title, address projectAddress);
    event Cancel(string title, address projectAddress);

    enum Status {
        Funding,
        Successful,
        Failed
    }

    Status public status;
    bool internal locked;
    address payable public creator; 
    string public title;
    uint public goal;               
    uint public deadline;           
    uint public idCounter;
    uint public minimumContribution = 0.01 ether; 
    mapping(address => uint) contributions;
    mapping(uint => address) awards;
    mapping(address => uint) ownedTokensCount;

    modifier onlyCreator {
        require(msg.sender == creator, "Not creator");
        _;
    }

    modifier atStatus(Status _status) {
        require(status == _status, "Cannot be called at this time.");
        _;
    }

    modifier checkFailed() {
        if ((block.timestamp >= deadline) && ((address(this).balance < goal))) {
            status = Status.Failed;
        }
        _;
    }
    
    modifier noReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }
    
    /// @notice Sets creator, goal, and deadline (30 days) for project
    /// @param _creator Creator of project
    /// @param _goal Amount of funding creator wants to raise for the project
    constructor(address _creator, string memory _title, uint _goal) {
        creator = payable(_creator);
        title = _title;
        goal = _goal * 1 ether;
        deadline = block.timestamp + 30 days;
    }
    
    /// @notice Can only contribute if project is still being Funded. 
    ///           - Bronze tier is granted to anyone contribution.
    ///           - Silver tier is granted to a total contribution of at least 0.25 ETH.
    ///           - Gold tier is granted to a total contribution of at least 1 ETH.
    function contribute() external checkFailed atStatus(Status.Funding) payable {
        require(msg.value >= minimumContribution, "Need to make a larger contribution");
        
        if (msg.value >= 1 ether && contributions[msg.sender] < 1 ether ) {
            _mint(1, msg.sender);
        } 
        else if (msg.value >= .25 ether && contributions[msg.sender] < .25 ether) {
            _mint(2, msg.sender);
            
        }
        else if (contributions[msg.sender] == 0) {
            _mint(3, msg.sender);
        }
        else{
        }

        contributions[msg.sender] += msg.value;

        if (address(this).balance >= goal) {
            status = Status.Successful;
            emit Success(title, address(this));
        }
    } 

    /// @notice Contributors can get a refund only if the project failed or creator cancelled
    function refund() external noReentrant checkFailed atStatus(Status.Failed) {
        require(contributions[msg.sender] > 0, "did not contribute");
        (bool sent, ) = msg.sender.call{value: contributions[msg.sender]}("");
        require(sent, "Failed to send refund");
        contributions[msg.sender] = 0;
    } 

    /// @notice Creators can withdraw a percentage of the funds only if project reached goal before deadline
    function withdraw(uint percentage) external onlyCreator atStatus(Status.Successful) {
        uint remove = (address(this).balance / 100) * percentage;
        (bool sent, ) = creator.call{value:remove}("");
        require(sent, "Failed to send Ether");
    }

    /// @notice Only creators can choose to cancel the project before the 30 days are over
    function cancel() external onlyCreator atStatus(Status.Funding) {      
        status = Status.Failed;
        emit Cancel(title, address(this));
    }

    /// @notice Retrieves the total contribution of the contributor
    function getContribution(address addr) external view returns (uint) {
        return contributions[addr];
    }

    /// @notice Mints id and transfers it to receiver
    /// @param tier Type of NFT: Gold (1), Silver (2), Bronze (3)
    /// @param receiver Address that will own the minted token
    function _mint(uint8 tier, address receiver) internal {
        require(receiver != address(0));   // Ensure address is not the 0 address
        uint id = (idCounter << 2) + tier; // Generate a token id
        idCounter += 1;                    // Increment the counter to ensure new id every time
        require(awards[id] == address(0), "ID already owned by someone else"); // Check that a token with the same token ID is not already owned by someone else
        awards[id] = receiver;             // Sets owner of ID to receiver address
        ownedTokensCount[receiver] += 1;   // Increases count of owned tokens
        emit Transfer(address(0), receiver, id);
    }

    /// @notice Retrieves last 2 bits of token ID and returns the tier (1, 2, or 3)
    /// @param tokenId Token ID that was issued
    function getTier(uint tokenId) public pure returns (uint8) {
        uint8 lastBits = uint8(tokenId) % 2 ** 2;
        return lastBits;
    }

    /// @notice Returns number of owned tokens in address's account
    /// @param _addr The address that function is finding balance of
    function balanceOf(address _addr) external view returns (uint) {
        require(_addr != address(0), "Cannot retrieve balance of 0 address");
        return ownedTokensCount[_addr];
    }

    /// @notice Returns the owener of the token id
    /// @param tokenId The token Id that function is finding owner of
    function ownerOf(uint tokenId) public view returns (address) {
        address owner = awards[tokenId];
        require(owner != address(0), "Token is nonexistent");
        return awards[tokenId];
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes memory data) external payable {
        revert();
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId) external payable {
        revert();
    }
    
    function transferFrom(address _from, address _to, uint256 _tokenId) external payable {
        revert();
    }

    function approve(address _approved, uint256 _tokenId) external payable {
        revert();
    }

    function setApprovalForAll(address _operator, bool _approved) external {
        revert();
    }
    
    function getApproved(uint256 _tokenId) external view returns (address) {
        revert();
    }

    function isApprovedForAll(address _owner, address _operator) external view returns (bool) {
        revert();
    }
}