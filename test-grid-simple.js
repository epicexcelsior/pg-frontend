// Simple test for Grid authentication
async function testAuth() {
    const workerUrl = "https://solana-auth.epic-740.workers.dev";
    const testEmail = "test@example.com";
    
    console.log("Testing Grid Auth Step 1: Sending OTP...");
    
    // Step 1: Send OTP
    const step1Response = await fetch(`${workerUrl}/grid-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
    });
    
    const step1Data = await step1Response.json();
    console.log("Step 1 Response:", { 
        status: step1Response.status, 
        ok: step1Response.ok, 
        data: step1Data 
    });
    
    if (step1Response.ok && step1Data.otp_sent) {
        console.log("✅ Step 1: OTP sent successfully!");
        console.log("📧 Check your email for OTP and run step 2 manually:");
        console.log(`fetch("${workerUrl}/grid-auth", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "${testEmail}", otp_code: "YOUR_OTP_CODE" })
}).then(r => r.json()).then(console.log);`);
    } else {
        console.log("❌ Step 1 failed:", step1Data);
    }
}

testAuth().catch(console.error);
