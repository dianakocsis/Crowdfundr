// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Project is ERC721 {

    event Success(string title, address projectAddress);
    event Cancel(string title, address projectAddress);

    enum Status {
        Funding,
        Successful,
        Failed
    }

    Status public status;
    address public immutable owner;
    uint256 public constant timeline = 30 days;
    uint public goal;
    uint public deadline;
    uint public idCounter;
    uint public minimumContribution = 0.01 ether;
    mapping(address => uint) contributions;
    mapping(uint => address) awards;
    mapping(address => uint) ownedTokensCount;

    error OnlyOwner(address owner);

    modifier atStatus(Status _status) {
        require(status == _status, "Cannot be called at this time.");
        _;
    }

    modifier checkFailed() {
        if ((status != Status.Failed) && (block.timestamp >= deadline) && (address(this).balance < goal)) {
            status = Status.Failed;
        }
        _;
    }

    /// @notice Creates a new Project contract
    /// @param _owner The owner of the project
    /// @param _goal The goal of the project
    /// @param _name The name of the project
    /// @param _symbol The symbol of the project
    constructor(address _owner, uint256 _goal, string memory _name, string memory _symbol) ERC721(_name, _symbol) {
        owner = _owner;
        goal = _goal;
        deadline = block.timestamp + timeline;
    }

    /// @notice Modifier to check if the caller is the owner
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner(owner);
        }
        _;
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
            emit Success(name(), address(this));
        }
    }

    /// @notice Contributors can get a refund only if the project failed or creator cancelled
    function refund() external checkFailed atStatus(Status.Failed) {
        require(contributions[msg.sender] > 0, "did not contribute");
        uint back = contributions[msg.sender];
        contributions[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: back}("");
        require(sent, "Failed to send refund");
    }

    /// @notice Creators can withdraw a percentage of the funds only if project reached goal before deadline
    function withdraw(uint percentage) external onlyOwner atStatus(Status.Successful) {
        uint remove = (address(this).balance / 100) * percentage;
        (bool sent, ) = owner.call{value:remove}("");
        require(sent, "Failed to send Ether");
    }

    /// @notice Only creators can choose to cancel the project before the 30 days are over
    function cancel() external onlyOwner atStatus(Status.Funding) {
        status = Status.Failed;
        emit Cancel(name(), address(this));
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
}
