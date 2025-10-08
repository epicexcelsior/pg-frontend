---
description: "Global Coding Rules for the Pls Give Project. These rules apply to all parts of the stack."
---
---
description: "Project-specific rules for the PlayCanvas frontend. This extends global_rules.md."
---

## 1. Adherence to Existing Frontend Architecture

You MUST conform to the established architectural patterns of this PlayCanvas project. Do not introduce new patterns without explicit discussion.

*   **Service-Oriented Architecture:** For core functionalities (Auth, Donations, UI Feedback), utilize or extend the existing services available via `Services.js`.
*   **Event-Driven Communication:** Scripts should communicate via the PlayCanvas event system (`this.app.fire`, `this.app.on`). Avoid direct script-to-script references (`this.entity.script.someOtherScript`) unless they are on the same entity and tightly coupled by design.
*   **Networking via MessageBroker:** All communication with the Colyseus server (sending and receiving messages) MUST be routed through `Network/MessageBroker.js`. Do not interact with the Colyseus room object directly from feature scripts.
*   **UI Separation (HTML Bridge):** Game logic scripts (`BoothController.js`, `ChatController.js`, etc.) should NOT manipulate the DOM directly. They should fire events that are handled by dedicated `UI/HtmlBridge/` scripts, which are responsible for all HTML/CSS interaction.

## 2. PlayCanvas Scripting Best Practices

*   **Lifecycle Functions:**
    *   Perform setup and find entities in `initialize()`.
    *   Always clean up event listeners (`this.app.off`) in a `destroy()` method to prevent memory leaks, especially for dynamically created entities.
*   **Performance:**
    *   Avoid allocations in `update()` (e.g., `new pc.Vec3()`). Pre-allocate vectors and other objects in `initialize()` and reuse them.
    *   Use the PlayCanvas attribute system for script properties to make them configurable in the editor.
*   **Scene & Entities:**
    *   Reference entities and assets via Script Attributes where possible, rather than hardcoding names with `this.app.root.findByName()`. This improves reusability.

## 3. Implementation Mindset

Before writing any code, internalize these points:
*   **Security:** Ensure server-authoritative logic for all critical actions. The frontend should securely communicate with the backend.
*   **Simplicity & Modularity:** Prioritize simple, maintainable, and extensible code.
*   **Review Existing Code:** Do not take any provided code as gospel. Be conscious of potential errors, security flaws, or inefficiencies and be assertive in correcting them.