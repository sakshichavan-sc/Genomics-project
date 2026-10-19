// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AnalysisPassportRegistry
/// @notice Immutable registry of GenomeProof analysis passport commitments.
/// @dev A record proves only that an authorized account registered a commitment at a time.
///      It does NOT prove scientific validity of the analysis.
contract AnalysisPassportRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Record {
        bytes32 commitment; // SHA256("GENOMEPROOF:ANALYSIS_PASSPORT:V1:" || canonical_manifest)
        bytes32 projectKey; // keccak256(projectId)
        address registrant;
        uint64 registeredAt;
    }

    /// passportKey = keccak256(abi.encode(projectId, analysisId))
    mapping(bytes32 => Record) private _records;
    mapping(bytes32 => bytes32) private _byCommitment; // commitment => passportKey
    uint256 public totalRegistrations;

    event PassportRegistered(
        bytes32 indexed passportKey,
        bytes32 indexed projectKey,
        bytes32 indexed commitment,
        address registrant,
        uint64 registeredAt
    );

    error EmptyValue();
    error AlreadyRegistered(bytes32 passportKey);
    error CommitmentAlreadyUsed(bytes32 commitment);

    constructor(address admin) {
        if (admin == address(0)) revert EmptyValue();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /// @notice Register a passport commitment. Records are immutable; publish a new
    ///         analysisId (e.g. "-v2") for a new version.
    function register(bytes32 passportKey, bytes32 projectKey, bytes32 commitment)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (passportKey == bytes32(0) || projectKey == bytes32(0) || commitment == bytes32(0)) revert EmptyValue();
        if (_records[passportKey].commitment != bytes32(0)) revert AlreadyRegistered(passportKey);
        if (_byCommitment[commitment] != bytes32(0)) revert CommitmentAlreadyUsed(commitment);

        uint64 ts = uint64(block.timestamp);
        _records[passportKey] = Record(commitment, projectKey, msg.sender, ts);
        _byCommitment[commitment] = passportKey;
        unchecked { totalRegistrations++; }
        emit PassportRegistered(passportKey, projectKey, commitment, msg.sender, ts);
    }

    function getRecord(bytes32 passportKey) external view returns (Record memory) {
        return _records[passportKey];
    }

    function passportKeyOf(bytes32 commitment) external view returns (bytes32) {
        return _byCommitment[commitment];
    }

    function isRegistrar(address account) external view returns (bool) {
        return hasRole(REGISTRAR_ROLE, account);
    }
}
