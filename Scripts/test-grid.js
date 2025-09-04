// Test script for Grid API integration
// This can be run in the browser console or as a standalone test

console.log("Starting Grid API integration test...");

// Test configuration
const testEmail = "test@example.com";
const colyseusBaseUrl = "http://localhost:3001/api";

// Test Grid Authentication
async function testGridAuth() {
    console.log("Testing Grid Authentication...");
    try {
        // Step 1: Send OTP
        console.log("Step 1: Sending OTP");
        const step1Response = await fetch(`${colyseusBaseUrl}/grid-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail })
        });

        const step1Data = await step1Response.json();
        console.log("Grid Auth Step 1 Response:", {
            status: step1Response.status,
            ok: step1Response.ok,
            data: step1Data
        });

        if (!step1Response.ok || !step1Data.session_id) {
            console.log("❌ Grid authentication step 1 failed:", step1Data.error);
            return null;
        }

        console.log("✅ Step 1 successful! Session ID:", step1Data.session_id);
        console.log("📧 Check your email for OTP and then run step 2:");
        console.log(`await testGridAuthStep2("${step1Data.session_id}", "YOUR_OTP_CODE");`);
        
        return { sessionId: step1Data.session_id, step: 1 };
    } catch (error) {
        console.error("❌ Grid authentication error:", error);
        return null;
    }
}

// Test Grid Authentication Step 2
async function testGridAuthStep2(sessionId, otpCode) {
    console.log("Testing Grid Authentication Step 2...");
    try {
        const response = await fetch(`${colyseusBaseUrl}/grid-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: testEmail,
                otp_code: otpCode,
                session_id: sessionId
            })
        });

        const data = await response.json();
        console.log("Grid Auth Step 2 Response:", {
            status: response.status,
            ok: response.ok,
            data: data
        });

        if (response.ok && data.sessionToken && data.walletAddress) {
            console.log("✅ Grid authentication successful!");
            return { 
                sessionToken: data.sessionToken, 
                walletAddress: data.walletAddress,
                sessionId: sessionId
            };
        } else {
            console.log("❌ Grid authentication step 2 failed:", data.error);
            return null;
        }
    } catch (error) {
        console.error("❌ Grid authentication step 2 error:", error);
        return null;
    }
}

// Test Grid Donation
async function testGridDonation(sessionId, recipient = "11111111111111111111111111111112", amount = 0.001) {
    console.log("Testing Grid Donation...");
    try {
        const response = await fetch(`${colyseusBaseUrl}/grid-execute-donation`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                session_id: sessionId,
                recipient: recipient,
                amount: amount 
            })
        });

        const data = await response.json();
        console.log("Grid Donation Response:", {
            status: response.status,
            ok: response.ok,
            data: data
        });

        if (response.ok && data.success && data.signature) {
            console.log("✅ Grid donation successful!");
            return data.signature;
        } else {
            console.log("❌ Grid donation failed:", data.error);
            if (data.error === 'AUTHORIZATION_REQUIRED') {
                console.log("⚠️  Spending limit required - this is expected behavior");
            }
            return null;
        }
    } catch (error) {
        console.error("❌ Grid donation error:", error);
        return null;
    }
}

// Test Grid Spending Limit
async function testGridSpendingLimit(sessionId, limitSOL = 1.0) {
    console.log("Testing Grid Spending Limit...");
    try {
        const response = await fetch(`${colyseusBaseUrl}/grid-set-spending-limit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                session_id: sessionId,
                policy: {
                    amount: Math.round(limitSOL * 1000000000), // lamports
                    period: 'day'
                },
                otp: 'test-otp' 
            })
        });

        const data = await response.json();
        console.log("Grid Spending Limit Response:", {
            status: response.status,
            ok: response.ok,
            data: data
        });

        if (response.ok && data.success) {
            console.log("✅ Grid spending limit set successfully!");
            return true;
        } else {
            console.log("❌ Grid spending limit failed:", data.error);
            return false;
        }
    } catch (error) {
        console.error("❌ Grid spending limit error:", error);
        return false;
    }
}

// Test Grid Onramp
async function testGridOnramp(sessionId, amount = 50, currency = 'USD') {
    console.log("Testing Grid Onramp...");
    try {
        const response = await fetch(`${colyseusBaseUrl}/grid-onramp`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                session_id: sessionId,
                amount: amount,
                currency: currency,
                success_url: `${window.location.origin}?onramp_success=true`,
                cancel_url: `${window.location.origin}?onramp_cancelled=true`
            })
        });

        const data = await response.json();
        console.log("Grid Onramp Response:", {
            status: response.status,
            ok: response.ok,
            data: data
        });

        if (response.ok && data.onramp_url) {
            console.log("✅ Grid onramp session created!");
            console.log("🔗 Onramp URL:", data.onramp_url);
            console.log("💡 You can test by opening this URL in a new tab");
            return data;
        } else {
            console.log("❌ Grid onramp failed:", data.error);
            return null;
        }
    } catch (error) {
        console.error("❌ Grid onramp error:", error);
        return null;
    }
}

// Run full test suite
async function runGridTests() {
    console.log("🚀 Running Grid API integration tests...");
    
    // Test 1: Authentication Step 1 (Send OTP)
    console.log("=== Step 1: Authentication (Send OTP) ===");
    const authStep1Result = await testGridAuth();
    if (!authStep1Result) {
        console.log("❌ Test suite failed at authentication step 1");
        return;
    }

    console.log("📧 Please check your email for the OTP code.");
    console.log("When you have the OTP, run the following to continue:");
    console.log(`runGridTestsStep2("${authStep1Result.sessionId}", "YOUR_OTP_CODE");`);
    
    return authStep1Result;
}

// Run test suite step 2 after getting OTP
async function runGridTestsStep2(sessionId, otpCode) {
    console.log("🚀 Continuing Grid API integration tests...");
    
    // Test 2: Authentication Step 2 (Verify OTP)
    console.log("=== Step 2: Authentication (Verify OTP) ===");
    const authResult = await testGridAuthStep2(sessionId, otpCode);
    if (!authResult) {
        console.log("❌ Test suite failed at authentication step 2");
        return;
    }

    // Test 3: Set spending limit (optional, may fail with API restrictions)
    console.log("=== Step 3: Set Spending Limit ===");
    await testGridSpendingLimit(authResult.sessionId);

    // Test 4: Execute donation
    console.log("=== Step 4: Execute Donation ===");
    await testGridDonation(authResult.sessionId);

    // Test 5: Test onramp (creates session but doesn't actually purchase)
    console.log("=== Step 5: Test Onramp ===");
    await testGridOnramp(authResult.sessionId, 25, 'USD');

    console.log("✅ Grid API integration tests completed!");
}

// Export for use in browser or other contexts
if (typeof window !== 'undefined') {
    window.testGrid = {
        testGridAuth,
        testGridAuthStep2,
        testGridDonation,
        testGridSpendingLimit,
        testGridOnramp,
        runGridTests,
        runGridTestsStep2
    };
    console.log("Grid test functions available as window.testGrid");
}

// Auto-run if in browser console or direct execution context
if (typeof window !== 'undefined' && window.location) {
    console.log("To run tests, execute: testGrid.runGridTests()");
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        testGridAuth, 
        testGridAuthStep2,
        testGridDonation, 
        testGridSpendingLimit, 
        testGridOnramp, 
        runGridTests,
        runGridTestsStep2
    };
}