import secret from "../../sol/id.json";
import * as token from "@solana/spl-token";
import { PublicKey, Keypair, Connection, SystemProgram, clusterApiUrl, SYSVAR_RENT_PUBKEY} from "@solana/web3.js";
import { Program, Wallet, AnchorProvider, BN, Idl } from '../dist/cjs';
import idl from "./idl.json";

const keyPair: Keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
const wallet = new Wallet(keyPair);

const connection: Connection = new Connection(clusterApiUrl('devnet'), "confirmed");
const provider = new AnchorProvider(connection,wallet as Wallet,{});

let programId = new PublicKey(idl.metadata.address);
const governanceProgram = new Program<Idl>(
    idl as Idl,
    programId,
    provider, 
    undefined, 
    undefined,
    true
);

(async() => {
    // Create Community Mint
    const communityMint = await token.createMint(connection, keyPair, keyPair.publicKey, keyPair.publicKey, 6);
    console.log("Community Mint Created: ",communityMint.toBase58());

    // Create Council Mint
    const councilMint = await token.createMint(connection, keyPair, keyPair.publicKey, keyPair.publicKey, 0);
    console.log("Council Mint Created: ", councilMint.toBase58());

    const name = "My Unique Name"

    const [governanceRealmAccount] = PublicKey.findProgramAddressSync([
        Buffer.from("governance"), 
        Buffer.from(name)
    ], programId);

    const [communityTokenHoldingAccount] = PublicKey.findProgramAddressSync([
        Buffer.from("governance"), 
        governanceRealmAccount.toBytes(),
        communityMint.toBytes()
    ], programId);

    const [councilTokenHoldingAccount] = PublicKey.findProgramAddressSync([
        Buffer.from("governance"), 
        governanceRealmAccount.toBytes(),
        councilMint.toBytes()
    ], programId);
    
    const [realmConfig] = PublicKey.findProgramAddressSync([
        Buffer.from("realm-config"), 
        governanceRealmAccount.toBytes()
    ], programId);

    const tx = await governanceProgram.methods.createRealm(
        { createRealm: {} },
        name, 
        {
            useCouncilMint: true,
            minCommunityWeightToCreateGovernance: new BN(1000000),
            communityTokenConfigArgs: {
                useVoterWeightAddin: false,
                useMaxVoterWeightAddin: false,
                tokenType: {
                    liquid: {}
                }
            },
            councilTokenConfigArgs: {
                useVoterWeightAddin: false,
                useMaxVoterWeightAddin: false,
                tokenType: {
                    membership: {}
                }
            },
            communityMintMaxVoterWeightSource: {
                supplyFraction: {
                    0: new BN(10000000000)
                }
            }
        })
    .accounts({
        governanceRealmAccount,
        realmAuthority: keyPair.publicKey,
        communityTokenMint: communityMint,
        tokenHoldingAccount: communityTokenHoldingAccount,
        payer: keyPair.publicKey,
        systemProgram: SystemProgram.programId,
        splTokenProgram: token.TOKEN_PROGRAM_ID,
        sysVarRent: SYSVAR_RENT_PUBKEY,
        councilTokenMint: councilMint,
        councilTokenHolding: councilTokenHoldingAccount,
        realmConfig: realmConfig,
        communityVoterWeight: programId,
        councilVoterWeight: programId,
        maxCommunityVoterWeight: programId,
        maxCouncilVoterWeight: programId,
    })
    .rpc();

    console.log("Transaction Successful: ", tx);
    console.log("DAO Created: ", governanceRealmAccount.toBase58());

    // Fetch the DAO we just created
    const dao = await governanceProgram.account.realmV2.fetch(governanceRealmAccount);
    console.log(dao);

    /* Fetch all the accounts of type RealmsV2
        This feature won't work without a GetProgramAccountsFilter[]
        since the discriminator is removed so it will try to fetch and
        deserialize all the accounts owned by the program
    */
    const daos = await governanceProgram.account.realmV2.all(
        [
            {
                memcmp: {
                    offset: 0,
                    bytes: "H"},
            }
        ]
    );
    console.log(daos);
})()

