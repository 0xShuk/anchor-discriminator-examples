import secret from "../../sol/id.json";
import * as token from "@solana/spl-token";
import { PublicKey, Keypair, Connection, SystemProgram, clusterApiUrl, LAMPORTS_PER_SOL} from "@solana/web3.js";
import { Program, Wallet, AnchorProvider, BN, Idl } from '../dist/cjs';
import idl from "./idl.json";

const keyPair: Keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
const wallet = new Wallet(keyPair);

const connection: Connection = new Connection(clusterApiUrl('devnet'), "confirmed");
const provider = new AnchorProvider(connection,wallet as Wallet,{});

let programId = new PublicKey(idl.metadata.address);
const tokenProgram = new Program<Idl>(
    idl as Idl,
    programId,
    provider, 
    undefined, 
    undefined,
    true
);

(async() => {
    const mintAccount = Keypair.generate();

    // Create Account IX - System Program
    const transferSOL = SystemProgram.createAccount({
        fromPubkey: keyPair.publicKey,
        newAccountPubkey: mintAccount.publicKey,
        lamports: LAMPORTS_PER_SOL * 0.0016,
        space: 82,
        programId: tokenProgram.programId
    });

    const tx = await tokenProgram.methods.initializeMint2(
        { initializeMint2: {} },
        6,
        keyPair.publicKey,
        keyPair.publicKey
    ).accounts({
        mint: mintAccount.publicKey,
    })
    .preInstructions([transferSOL])
    .signers([mintAccount])
    .rpc();

    console.log("TX Successful: ", tx);
    console.log("Mint Account created: ", mintAccount.publicKey.toBase58());

    // Fetch the mint account
    const mint = await tokenProgram.account.mint.fetch(mintAccount.publicKey.toBase58());
    console.log(mint);
})()