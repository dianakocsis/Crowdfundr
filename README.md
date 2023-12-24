# Crowdfundr Project

## Project Spec

- There should be a ProjectFactory contract with a create method that deploys instances of the Project contract using the factory create pattern.
    - Each Project instance should be able to receive contributions independent of the others.
    - Each project has a goal amount, in ETH, which cannot be changed after a project gets created.

- The requirements for contributions are as follows:
    - The contribution amount must be at least 0.01 ETH.
    - There is no upper limit on contribution size.
    - Anyone can contribute to the project, including the creator.
    - One address can contribute as many times as they like.
    - No one can withdraw their funds until the project either fails or gets cancelled.

- The requirements for contributor badges are as follows:
    - Each project should use its own NFT contract.
    - An address earns 1 badge for each 1 ETH in their total contribution for that project.
    - One address can earn multiple badges for a single project, but should only earn 1 badge per 1 ETH.
        - For example, if Alice contributes 0.4 ETH to Project A, she is owed 0 badges. If she then contributes 0.7 ETH to Project A, her total contribution to that project is now 1.1 ETH, so she is owed 1 badge. If she then contributes 1 ETH, her total contribution is now 2.1 ETH, and she has earned 2 badges total.
    - The minting of badges should not happen in the same contract call as the contribution. In other words, there should be a separate function for a user to claim the contributor badges they are owed.
        - When an address calls this claim function, they should receive the correct number of badges based on their total contribution so far, while accounting for any badges that were previously claimed.
        When the claim function is called by a contract, that contract must indicate it is able to handle NFTs or else the transaction should revert.
    - Regardless of the end result of the crowdfunding effort, the project's badges are left alone. They should still be transferable.

- The terminal states of a project are as follows:

    - If the project is not fully funded within 30 days:
        - The project goal is considered to have failed.
        - No one can contribute anymore.
        - Contributors can get a refund of their contribution.

    - Once a project becomes fully funded:
        - No one else can contribute (however, the last contribution can go over the goal).
        - The creator cannot cancel the project.
       - The creator can withdraw any amount of contributed funds.

    - Before the 30 days are over and if the project is not yet fully funded, the creator can cancel the project.
        - This should have the same effect as a project failing to reach its goal within the 30 days.
