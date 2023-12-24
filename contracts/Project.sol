// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Project is ERC721 {

    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;
    uint256 public constant TIMELINE = 30 days;
    address public immutable owner;
    uint256 public immutable goal;
    uint256 public immutable deadline;
    Status public status;
    uint256 public totalFunds;
    uint256 public currentFunds;
    uint256 public tokenId = 1;
    uint public idCounter;
    uint public minimumContribution = 0.01 ether;
    mapping(address => uint256) public contributions;
    mapping(uint => address) awards;
    mapping(address => uint) ownedTokensCount;
    mapping(address => uint256) public tokensClaimed;
    bool public canceled;

    enum Status {
        Active,
        Canceled,
        Expired,
        Completed
    }

    event Success(string title, address projectAddress);
    event Cancel(string title, address projectAddress);
    event Contributed(address contributor, uint256 value);
    event Canceled();
    event Claimed(address claimer, uint256 tokens);
    event Withdrawn(address owner, uint256 value);

    error OnlyOwner(address owner);
    error InvalidContribution(uint256 value);
    error CannotContribute();
    error CannotCancel();
    error CannotClaim();
    error CannotWithdraw();
    error TransferFailed(bytes data);

    modifier atStatus(Status _status) {
        require(status == _status, "Cannot be called at this time.");
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
        deadline = block.timestamp + TIMELINE;
    }

    /// @notice Modifier to check if the caller is the owner
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner(owner);
        }
        _;
    }

    /// @notice Contributes to the project
    function contribute() external payable {
        if (getStatus() != Status.Active) revert CannotContribute();
        if (msg.value < MIN_CONTRIBUTION) revert InvalidContribution(msg.value);
        contributions[msg.sender] += msg.value;
        totalFunds += msg.value;
        currentFunds += msg.value;

        emit Contributed(msg.sender, msg.value);
    }

    /// @notice Claims tokens for the contributor
    /// @param _to The address to send the tokens to
    function claim(address _to) external {
        uint256 totalTokens =  contributions[msg.sender] / 1 ether;
        uint256 tokensToClaim = totalTokens - tokensClaimed[msg.sender];
        if (tokensToClaim == 0) revert CannotClaim();
        tokensClaimed[msg.sender] += tokensToClaim;
        emit Claimed(_to, tokensToClaim);
        for (uint256 i = 0; i < tokensToClaim; i++) {
            _safeMint(_to, tokenId++);
        }
    }

    /// @notice Contributors can get a refund only if the project failed or creator cancelled
    function refund() external {
        require(contributions[msg.sender] > 0, "did not contribute");
        uint back = contributions[msg.sender];
        contributions[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: back}("");
        require(sent, "Failed to send refund");
    }

    /// @notice Withdraws funds from the project
    /// @param _to The address to send the funds to
    /// @param _amount The amount to withdraw
    /// @dev Only the owner can withdraw funds
    function withdraw(address payable _to, uint256 _amount) external onlyOwner {
        if (getStatus() != Status.Completed) revert CannotWithdraw();
        currentFunds -= _amount;
        emit Withdrawn(_to, _amount);
        (bool success, bytes memory data) = _to.call{value: _amount}("");
        if (!success) {
            revert TransferFailed(data);
        }
    }

    /// @notice Cancels the project
    /// @dev Only the owner can cancel the project
    function cancel() external onlyOwner {
        if (getStatus() != Status.Active) revert CannotCancel();
        canceled = true;
        emit Canceled();
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

    /// @notice Returns the current status of the project
    /// @return The current status of the project
    function getStatus() public view returns (Status) {
        if (canceled) {
            return Status.Canceled;
        } else if (totalFunds >= goal) {
            return Status.Completed;
        } else if (block.timestamp >= deadline) {
            return Status.Expired;
        } else {
            return Status.Active;
        }
    }
}
