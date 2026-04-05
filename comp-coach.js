/**
 * AI-Enhanced Strategy Coaching
 * Evaluates the drafting composition and provides warnings for missing critical meta roles/agents.
 */

window.evaluateComposition = function() {
    const coachContainer = document.getElementById('ai-coach-alerts');
    if (!coachContainer) return;

    if (!window.state || !window.state.currentMap || !window.state.currentComp) {
        coachContainer.innerHTML = '';
        return;
    }

    const currentMapName = window.state.currentMap.displayName;
    
    // Retrieve agents picked (filter out empty slots)
    const pickedAgents = window.state.currentComp
        .map(uuid => window.state.agents.find(a => a.uuid === uuid))
        .filter(Boolean);
        
    // Wait until there are at least 3 agent picks to start judging heavily
    if (pickedAgents.length < 3) {
        coachContainer.innerHTML = '';
        return;
    }

    const roles = {
        Controller: 0,
        Duelist: 0,
        Initiator: 0,
        Sentinel: 0
    };
    
    const pickedNames = pickedAgents.map(a => a.displayName);

    pickedAgents.forEach(a => {
        if (a.role && a.role.displayName) {
            roles[a.role.displayName]++;
        }
    });

    const warnings = [];

    // General Meta Checks
    if (roles.Controller === 0) {
        warnings.push("Critical: You have no Smokes (Controller). Your executes will be easily stopped.");
    }
    if (roles.Initiator === 0) {
        warnings.push("Warning: No Initiator detected. Gathering info on sites will be difficult.");
    }
    
    // Map Specific Rules
    if (currentMapName === "Icebox") {
        if (!pickedNames.includes("Viper")) {
            warnings.push("Icebox Meta: Viper is almost mandatory for slicing the A and B site verticality.");
        }
        if (!pickedNames.includes("Sage")) {
            warnings.push("Icebox Meta: Sage is highly recommended for safe B-site plants.");
        }
    } else if (currentMapName === "Breeze") {
        if (!pickedNames.includes("Viper") && !pickedNames.includes("Harbor")) {
            warnings.push("Breeze Meta: A Wall Controller (Viper/Harbor) is essential on this map.");
        }
    } else if (currentMapName === "Ascent") {
        if (roles.Controller === 0 || (!pickedNames.includes("Omen") && !pickedNames.includes("Astra"))) {
            warnings.push("Ascent Meta: A dome smoker like Omen or Astra is normally preferred here.");
        }
        if (!pickedNames.includes("Sova") && !pickedNames.includes("Fade")) {
            warnings.push("Ascent Meta: Sova or Fade is critical for clearing out deep corners and B-Main.");
        }
    } else if (currentMapName === "Bind") {
        if (roles.Controller < 2 && pickedAgents.length === 5) {
            warnings.push("Bind Meta: Double controller setups are extremely powerful here.");
        }
    }

    // Render Alerts
    if (warnings.length > 0) {
        const html = warnings.map(w => `<div class="ai-coach-alert-item">⚠️ ${w}</div>`).join('');
        coachContainer.innerHTML = `<div class="ai-coach-box"><strong>AI Coach Analysis:</strong><br>${html}</div>`;
    } else {
        coachContainer.innerHTML = `<div class="ai-coach-box ai-coach-good"><strong>AI Coach Analysis:</strong><br>✅ Composition looks solid and meta-aligned!</div>`;
    }
};
