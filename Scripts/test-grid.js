// Test script for Grid API integration
// This can be run in the browser console or as a standalone test

console.log("Starting Grid API integration test...");

// Test configuration
const testEmail = "test@example.com";
const workerBaseUrl = "http://localhost:8787";

// Test Grid Authentication
async function testGridAuth() {
    console.log("Testing Grid Authentication...");
    try {
        const response = await fetch(`${workerBaseUrl}/grid-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail })
        });

        const data = await response.json();
        console.log("Grid Auth Response:", {
            status: response.status,
            ok: response.ok,
            data: data
        });

        if (response.ok && data.sessionToken && data.walletAddress) {
            console.log("✅ Grid authentication successful!");
            return { sessionToken: data.sessionToken, walletAddress: data.walletAddress };
        } else {
            console.log("❌ Grid authentication failed:", data.error);
            return null;
        }
    } catch (error) {
        console.error("❌ Grid authentication error:", error);
        return null;
    }
}

// Test Grid Donation
async function testGridDonation(sessionToken, recipient = "11111111111111111111111111111112", amount = 0.001) {
    console.log("Testing Grid Donation...");
    try {
        const response = await fetch(`${workerBaseUrl}/grid-execute-donation`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ recipient, amount })
        });

        const data = await response.json();
        console.log("Grid Donation Response:", {
            status: response.status,
            ok: response.ok,
            data: data
        });

        if (response.ok && data.signature) {
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
async function testGridSpendingLimit(sessionToken, limitSOL = 1.0) {
    console.log("Testing Grid Spending Limit...");
    try {
        const response = await fetch(`${workerBaseUrl}/grid-set-spending-limit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ 
                policy: {
                    daily_limit: {
                        amount: Math.round(limitSOL * 1000000000), // Convert SOL to lamports
                        currency: 'lamports'
                    }
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
async function testGridOnramp(sessionToken, amount = 50, currency = 'USD') {
    console.log("Testing Grid Onramp...");
    try {
        const response = await fetch(`${workerBaseUrl}/grid-onramp`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ 
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
    
    // Test 1: Authentication
    const authResult = await testGridAuth();
    if (!authResult) {
        console.log("❌ Test suite failed at authentication step");
        return;
    }

    // Test 2: Set spending limit (optional, may fail with API restrictions)
    await testGridSpendingLimit(authResult.sessionToken);

    // Test 3: Execute donation
    await testGridDonation(authResult.sessionToken);

    // Test 4: Test onramp (creates session but doesn't actually purchase)
    await testGridOnramp(authResult.sessionToken, 25, 'USD');

    console.log("✅ Grid API integration tests completed!");
}

// Export for use in browser or other contexts
if (typeof window !== 'undefined') {
    window.testGrid = {
        testGridAuth,
        testGridDonation,
        testGridSpendingLimit,
        testGridOnramp,
        runGridTests
    };
    console.log("Grid test functions available as window.testGrid");
}

// Auto-run if in browser console or direct execution context
if (typeof window !== 'undefined' && window.location) {
    console.log("To run tests, execute: testGrid.runGridTests()");
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testGridAuth, testGridDonation, testGridSpendingLimit, testGridOnramp, runGridTests };
}