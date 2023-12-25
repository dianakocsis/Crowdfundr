// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Project is ERC721 {

    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;
    uint256 public constant TIMELINE = 30 days;
    address public immutable owner;
    uint256 public immutable goal;
    uint256 public immutable deadline;
    uint256 public totalFunds;
    uint256 public currentFunds;
    uint256 public tokenId = 1;
    mapping(address => uint256) public contributions;
    mapping(address => uint256) public tokensClaimed;
    bool public canceled;

    enum Status {
        Active,
        Canceled,
        Expired,
        Completed
    }

    event Contributed(address indexed contributor, uint256 value);
    event Claimed(address indexed claimer, uint256 tokens);
    event Withdrawn(address indexed owner, uint256 value);
    event Canceled();
    event Refunded(address indexed contributor, uint256 value);

    error OnlyOwner(address owner);
    error CannotContribute();
    error InvalidContribution(uint256 value);
    error CannotClaim();
    error CannotWithdraw();
    error CannotCancel();
    error CannotRefund();
    error TransferFailed(bytes data);

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

    /// @notice Refunds the contributor
    /// @param _to The address to send the refund to
    function refund(address payable _to) external {
        if ((getStatus() != Status.Expired && getStatus() != Status.Canceled) ||
            contributions[msg.sender] == 0) revert CannotRefund();
        uint256 refundAmount = contributions[msg.sender];
        contributions[msg.sender] = 0;
        emit Refunded(_to, refundAmount);
        (bool success, bytes memory data) = _to.call{value: refundAmount}("");
        if (!success) {
            revert TransferFailed(data);
        }
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
