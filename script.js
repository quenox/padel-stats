document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const setupScreen = document.getElementById('setup-screen');
    const matchScreen = document.getElementById('match-screen');
    const statsScreen = document.getElementById('stats-screen');

    const playerInputs = [
        document.getElementById('player1-name'),
        document.getElementById('player2-name'),
        document.getElementById('player3-name'),
        document.getElementById('player4-name')
    ];
    const numSetsSelect = document.getElementById('num-sets');
    const firstServerSelect = document.getElementById('first-server');
    const startMatchBtn = document.getElementById('start-match-btn');

    const p1NameDisplay = document.getElementById('p1-name-display');
    const p2NameDisplay = document.getElementById('p2-name-display');
    const p3NameDisplay = document.getElementById('p3-name-display');
    const p4NameDisplay = document.getElementById('p4-name-display');
    const team1SetsElement = document.getElementById('team1-sets');
    const team2SetsElement = document.getElementById('team2-sets');
    const team1GamesElement = document.getElementById('team1-games');
    const team2GamesElement = document.getElementById('team2-games');
    const team1PointsElement = document.getElementById('team1-points');
    const team2PointsElement = document.getElementById('team2-points');
    const serverIndicator = document.getElementById('current-server-name');
    const team1InlineName = document.querySelector('.team1-inline-name');
    const team2InlineName = document.querySelector('.team2-inline-name');


    const pointButtons = document.querySelectorAll('.point-btn');
    const undoBtn = document.getElementById('undo-btn');
    const finishMatchBtn = document.getElementById('finish-match-btn');

    const finalResultElement = document.getElementById('final-result');
    const statsDetailsElement = document.getElementById('stats-details');
    const pointHistoryLog = document.getElementById('point-history-log'); // For debugging
    const newMatchBtn = document.getElementById('new-match-btn');

    // --- Game State ---
    let matchState = null; // Will be initialized on match start

    const pointValues = ["0", "15", "30", "40", "AD"]; // Padel point sequence

    // --- Functions ---

    function deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function initializeMatchState() {
        matchState = {
            players: [
                { id: 1, name: playerInputs[0].value.trim(), stats: { winners: 0, unforcedErrors: 0 } },
                { id: 2, name: playerInputs[1].value.trim(), stats: { winners: 0, unforcedErrors: 0 } },
                { id: 3, name: playerInputs[2].value.trim(), stats: { winners: 0, unforcedErrors: 0 } },
                { id: 4, name: playerInputs[3].value.trim(), stats: { winners: 0, unforcedErrors: 0 } },
            ],
            teams: [
                { players: [1, 2], score: { sets: 0, games: 0, points: "0", tieBreakPoints: 0 } }, // Team 0
                { players: [3, 4], score: { sets: 0, games: 0, points: "0", tieBreakPoints: 0 } }  // Team 1
            ],
            settings: {
                numSets: parseInt(numSetsSelect.value),
                firstServerId: parseInt(firstServerSelect.value)
            },
            currentSet: 1,
            currentGame: 1,
            server: null, // ID of the player currently serving
            servingTeamIndex: null, // 0 or 1
            isTieBreak: false,
            matchOver: false,
            pointHistory: [], // To store state snapshots for undo
            // Server rotation within game: A serves, then C, then B, then D
            // We need to know who served the *previous* game to know who serves next
            lastGameServerId: null,
            // We need to know who started serving the *set* to alternate starts
            setInitialServerId: null,
             // Track server order within tiebreak
            tieBreakServerSequence: [],
            currentTieBreakServerIndex: 0,
        };

        // Determine initial server and team
        matchState.server = matchState.settings.firstServerId;
        matchState.setInitialServerId = matchState.server;
        matchState.servingTeamIndex = (matchState.server === 1 || matchState.server === 2) ? 0 : 1;
        matchState.lastGameServerId = null; // No previous game yet

        console.log("Match Initialized:", deepCopy(matchState));
    }

    function getPlayerById(id) {
        return matchState.players.find(p => p.id === id);
    }

     function getTeamIndexByPlayerId(id) {
        return (id === 1 || id === 2) ? 0 : 1;
     }

    function updateUI() {
        if (!matchState || matchState.matchOver) return;

        const team1 = matchState.teams[0];
        const team2 = matchState.teams[1];

        // Update names
        p1NameDisplay.textContent = getPlayerById(1).name;
        p2NameDisplay.textContent = getPlayerById(2).name;
        p3NameDisplay.textContent = getPlayerById(3).name;
        p4NameDisplay.textContent = getPlayerById(4).name;
        team1InlineName.textContent = `${getPlayerById(1).name}/${getPlayerById(2).name}`;
        team2InlineName.textContent = `${getPlayerById(3).name}/${getPlayerById(4).name}`;

        // Update scores
        team1SetsElement.textContent = team1.score.sets;
        team2SetsElement.textContent = team2.score.sets;
        team1GamesElement.textContent = team1.score.games;
        team2GamesElement.textContent = team2.score.games;

        if (matchState.isTieBreak) {
            team1PointsElement.textContent = team1.score.tieBreakPoints;
            team2PointsElement.textContent = team2.score.tieBreakPoints;
        } else {
            team1PointsElement.textContent = team1.score.points;
            team2PointsElement.textContent = team2.score.points;
        }


        // Update server indicator
        const serverPlayer = getPlayerById(matchState.server);
        serverIndicator.textContent = serverPlayer ? serverPlayer.name : '---';

         // Highlight serving player name in scoreboard (optional visual cue)
         document.querySelectorAll('.team-names span').forEach(span => span.classList.remove('serving'));
         if (serverPlayer) {
             let serverNameSpan;
             if(serverPlayer.id === 1) serverNameSpan = p1NameDisplay;
             else if (serverPlayer.id === 2) serverNameSpan = p2NameDisplay;
             else if (serverPlayer.id === 3) serverNameSpan = p3NameDisplay;
             else if (serverPlayer.id === 4) serverNameSpan = p4NameDisplay;
             if(serverNameSpan) serverNameSpan.classList.add('serving');
         }


        // Enable/disable undo button
        undoBtn.disabled = matchState.pointHistory.length === 0;

        // Log history (for debugging)
        pointHistoryLog.innerHTML = '<h4>Historial de Puntos (Debug)</h4>';
        matchState.pointHistory.forEach((p, index) => {
            const logEntry = document.createElement('div');
            logEntry.textContent = `P${index+1}: Team ${p.details.winningTeamIndex+1} won (${p.details.pointType} by J${p.details.involvedPlayerId}). Score: ${p.stateBefore.teams[0].score.sets}-${p.stateBefore.teams[1].score.sets}, ${p.stateBefore.teams[0].score.games}-${p.stateBefore.teams[1].score.games}, ${p.stateBefore.teams[0].score.points}-${p.stateBefore.teams[1].score.points}. Server: J${p.stateBefore.server}`;
            pointHistoryLog.appendChild(logEntry);
        });
         pointHistoryLog.scrollTop = pointHistoryLog.scrollHeight; // Scroll to bottom


        console.log("UI Updated. Current State:", deepCopy(matchState));
    }

    function saveStateBeforePoint(details) {
         const stateCopy = {
             teams: deepCopy(matchState.teams),
             server: matchState.server,
             servingTeamIndex: matchState.servingTeamIndex,
             isTieBreak: matchState.isTieBreak,
             currentSet: matchState.currentSet,
             currentGame: matchState.currentGame,
             lastGameServerId: matchState.lastGameServerId,
             setInitialServerId: matchState.setInitialServerId,
             tieBreakServerSequence: deepCopy(matchState.tieBreakServerSequence),
             currentTieBreakServerIndex: matchState.currentTieBreakServerIndex,
             // Include player stats if needed for perfect undo, but can be heavy
             // players: deepCopy(matchState.players)
         };
         matchState.pointHistory.push({ stateBefore: stateCopy, details: details });
    }

    function determineNextServer() {
        // Called AFTER a game or tiebreak point that requires server change
        if (matchState.isTieBreak) {
            const totalPoints = matchState.teams[0].score.tieBreakPoints + matchState.teams[1].score.tieBreakPoints;
             // First point: server doesn't change yet.
             // After 1st point, change server. Then change every 2 points.
            if (totalPoints > 0 && (totalPoints === 1 || totalPoints % 2 !== 0)) {
                 matchState.currentTieBreakServerIndex = (matchState.currentTieBreakServerIndex + 1) % 4; // Cycle through 4 players
                 matchState.server = matchState.tieBreakServerSequence[matchState.currentTieBreakServerIndex];
                 matchState.servingTeamIndex = getTeamIndexByPlayerId(matchState.server);
            }
             // Server stays same on points 0, 2, 4, 6, 8... (even sums after point is played)
        } else {
             // Standard game finished, determine server for the *next* game
             const serverOrder = [1, 3, 2, 4]; // Standard serving rotation pattern J1->J3->J2->J4
             let currentServerIndex = serverOrder.indexOf(matchState.lastGameServerId); // Who served the game just finished?
              if (currentServerIndex === -1) {
                 // This happens for the *first* game of the set
                 currentServerIndex = serverOrder.indexOf(matchState.setInitialServerId);
             }
             const nextServerIndex = (currentServerIndex + 1) % 4;
             matchState.server = serverOrder[nextServerIndex];
             matchState.servingTeamIndex = getTeamIndexByPlayerId(matchState.server);
             // Store who served this game for the *next* game's calculation
              matchState.lastGameServerId = matchState.server; // Incorrect: Need to store who *finished* serving the game
        }
         console.log(`Next server determined: Player ${matchState.server} (Team ${matchState.servingTeamIndex + 1})`);
    }

     // Helper to set who just served the completed game
     function recordGameServer(serverWhoFinishedGame) {
         matchState.lastGameServerId = serverWhoFinishedGame;
     }


     function determineTieBreakStartServer() {
        // The player whose turn it would have been to serve the *next* game serves the first point of the tiebreak.
        const serverOrder = [1, 3, 2, 4];
        let lastServerIdx = serverOrder.indexOf(matchState.lastGameServerId);
         // If it's the very first game (6-6), use the set initial server logic
         if (matchState.currentGame === 13 && matchState.lastGameServerId === null) {
             lastServerIdx = serverOrder.indexOf(matchState.setInitialServerId);
             // Find who served game 12. If J1 started set, J4 served game 12. J1 serves next (tiebreak).
              // If J3 started set, J2 served game 12. J3 serves next (tiebreak).
             if (matchState.setInitialServerId === 1) lastServerIdx = serverOrder.indexOf(4); // J4 finished game 12
             else lastServerIdx = serverOrder.indexOf(2); // J2 finished game 12
         }

        const nextServerIndex = (lastServerIdx + 1) % 4;
        const tieBreakInitialServer = serverOrder[nextServerIndex];

         // Set the serving sequence for the tiebreak: J_initial -> J_opponent1 -> J_opponent2 -> J_partner -> J_initial ...
         const initialServerTeam = getTeamIndexByPlayerId(tieBreakInitialServer);
         const opponentTeam = initialServerTeam === 0 ? 1 : 0;
         const opponent1 = matchState.teams[opponentTeam].players[0];
         const opponent2 = matchState.teams[opponentTeam].players[1];
         const partner = matchState.teams[initialServerTeam].players.find(p => p !== tieBreakInitialServer);

         // Define the serving order (adjust based on who starts)
          matchState.tieBreakServerSequence = [
                tieBreakInitialServer, // Serves 1st point
                opponent1,          // Serves next 2 points
                opponent2,          // Serves next 2 points
                partner             // Serves next 2 points
            ];

         // Ensure the sequence has all 4 players correctly placed relative to the initial server.
         // Example: If J3 starts tiebreak (partner J4, opp J1, J2)
         // Sequence should be [J3, J1, J2, J4]
          const partnerId = matchState.teams[initialServerTeam].players.find(pId => pId !== tieBreakInitialServer);
          let correctSequence = [tieBreakInitialServer];
          // Decide opponent order based on who served the *previous* game maybe? Padel rules can be tricky here.
          // Let's assume a fixed rotation for simplicity: initial -> opp1 -> opp2 -> partner
          // We need the specific IDs based on `tieBreakInitialServer`
          if (tieBreakInitialServer === 1) correctSequence = [1, 3, 4, 2];
          else if (tieBreakInitialServer === 2) correctSequence = [2, 3, 4, 1];
          else if (tieBreakInitialServer === 3) correctSequence = [3, 1, 2, 4];
          else if (tieBreakInitialServer === 4) correctSequence = [4, 1, 2, 3];

           matchState.tieBreakServerSequence = correctSequence;


         matchState.server = tieBreakInitialServer; // Set the first server
         matchState.servingTeamIndex = getTeamIndexByPlayerId(matchState.server);
         matchState.currentTieBreakServerIndex = 0; // Start at the beginning of the sequence
         console.log(`Tiebreak started. Initial Server: ${matchState.server}. Sequence: ${matchState.tieBreakServerSequence}`);
     }


    function addPoint(winningTeamIndex, pointType, involvedPlayerId) {
        if (matchState.matchOver) return;

        const details = { winningTeamIndex, pointType, involvedPlayerId };
        saveStateBeforePoint(details); // Save state *before* changes

        // --- Update Stats ---
        const involvedPlayer = getPlayerById(involvedPlayerId);
        if (pointType === 'winner') {
            involvedPlayer.stats.winners++;
        } else if (pointType === 'unforcedError') {
            involvedPlayer.stats.unforcedErrors++;
        }

        // --- Update Score ---
        const winningTeam = matchState.teams[winningTeamIndex];
        const losingTeam = matchState.teams[1 - winningTeamIndex];

        if (matchState.isTieBreak) {
            winningTeam.score.tieBreakPoints++;
            const totalPoints = winningTeam.score.tieBreakPoints + losingTeam.score.tieBreakPoints;

            // Check for TieBreak Win
            // Win by reaching 7+ points with a margin of 2
            if (winningTeam.score.tieBreakPoints >= 7 && (winningTeam.score.tieBreakPoints - losingTeam.score.tieBreakPoints >= 2)) {
                 console.log(`Tiebreak won by Team ${winningTeamIndex + 1}`);
                winGame(winningTeamIndex); // Winning the tiebreak wins the game (and thus the set)
            } else {
                 // Determine server change within tiebreak
                 determineNextServer();
            }

        } else {
            // Standard Game Scoring
            const currentPointIndex = pointValues.indexOf(winningTeam.score.points);
            const opponentPointIndex = pointValues.indexOf(losingTeam.score.points);

            if (currentPointIndex === 3 && opponentPointIndex < 3) { // Player at 40 wins against <= 30
                winGame(winningTeamIndex);
            } else if (currentPointIndex === 3 && opponentPointIndex === 3) { // Deuce (40-40), winner goes to AD
                winningTeam.score.points = "AD";
            } else if (currentPointIndex === 3 && opponentPointIndex === 4) { // Player at 40 vs AD, loser goes back to Deuce
                losingTeam.score.points = "40"; // Back to deuce
            } else if (currentPointIndex === 4) { // Player at AD wins
                winGame(winningTeamIndex);
            } else { // Standard point win (0->15, 15->30, 30->40)
                winningTeam.score.points = pointValues[currentPointIndex + 1];
            }

             // If game wasn't won, points for the loser remain unchanged unless it was AD vs 40 situation
              if (!matchState.isTieBreak && winningTeam.score.points === "40" && losingTeam.score.points === "AD") {
                  // Handled above: losingTeam.score.points = "40";
              } else if (!matchState.isTieBreak && currentPointIndex < 4 && opponentPointIndex === 4) {
                  // If winner is not AD, and loser *was* AD, loser goes back to 40
                  // This case shouldn't happen if logic above is correct, but double check needed
              }
        }

        // --- Update UI ---
         // Only update UI if the game/set/match isn't over yet, or if it just finished
         if (!matchState.matchOver || (matchState.matchOver && matchState.pointHistory.length > 0 && matchState.pointHistory[matchState.pointHistory.length - 1].details === details)) {
            updateUI();
         }
    }


    function winGame(winningTeamIndex) {
         const serverWhoFinishedGame = matchState.server; // Store who was serving when game ended
         recordGameServer(serverWhoFinishedGame); // Record it for next server logic

        matchState.teams[winningTeamIndex].score.games++;
        matchState.currentGame++;
        // Reset points
        matchState.teams[0].score.points = "0";
        matchState.teams[1].score.points = "0";
         matchState.teams[0].score.tieBreakPoints = 0; // Also reset tiebreak points
         matchState.teams[1].score.tieBreakPoints = 0;

         matchState.isTieBreak = false; // Game finished, no longer in tiebreak (even if it was won)


         console.log(`Game ${matchState.currentGame - 1} won by Team ${winningTeamIndex + 1}. Score: ${matchState.teams[0].score.games}-${matchState.teams[1].score.games}`);

        // --- Check for Set Win ---
        const winnerGames = matchState.teams[winningTeamIndex].score.games;
        const loserGames = matchState.teams[1 - winningTeamIndex].score.games;

        let setWon = false;
        if (winnerGames >= 6 && (winnerGames - loserGames >= 2)) {
            setWon = true;
        } else if (winnerGames === 7 && loserGames === 5) {
            setWon = true;
        } else if (winnerGames === 7 && loserGames === 6) { // Set won via tie-break
             setWon = true;
        }


        if (setWon) {
            winSet(winningTeamIndex);
        } else if (winnerGames === 6 && loserGames === 6) {
            // --- Start TieBreak ---
             console.log("Starting TieBreak!");
            matchState.isTieBreak = true;
            determineTieBreakStartServer(); // Determine who serves first in the tiebreak
        } else {
             // --- Determine Server for Next Game ---
             determineNextServer();
        }
         // Don't update UI here, it will be updated after potential set/match checks or next server determined.
    }

    function winSet(winningTeamIndex) {
        matchState.teams[winningTeamIndex].score.sets++;
        matchState.currentSet++;
         // Reset games for the new set
        matchState.teams[0].score.games = 0;
        matchState.teams[1].score.games = 0;
        matchState.currentGame = 1; // Reset game counter for the new set
        matchState.isTieBreak = false; // Reset tiebreak status

         console.log(`Set ${matchState.currentSet - 1} won by Team ${winningTeamIndex + 1}. Set Score: ${matchState.teams[0].score.sets}-${matchState.teams[1].score.sets}`);


        // --- Check for Match Win ---
        const setsToWin = Math.ceil(matchState.settings.numSets / 2);
        if (matchState.teams[winningTeamIndex].score.sets === setsToWin) {
            finishMatch();
        } else {
            // --- Determine who serves first in the new set ---
            // Service alternates at the start of each set
            matchState.setInitialServerId = (matchState.setInitialServerId === 1 || matchState.setInitialServerId === 2)
                 ? matchState.teams[1].players[0] // If team 1 served first last set, team 2 serves first now (player 3)
                 : matchState.teams[0].players[0]; // If team 2 served first last set, team 1 serves first now (player 1)
            matchState.server = matchState.setInitialServerId;
            matchState.servingTeamIndex = getTeamIndexByPlayerId(matchState.server);
            matchState.lastGameServerId = null; // Reset for the new set

            console.log(`Starting Set ${matchState.currentSet}. Initial server: Player ${matchState.server}`);
        }
         // UI update will happen either in finishMatch or after next server determined
    }

    function undoLastPoint() {
        if (matchState.pointHistory.length === 0) return;

        const lastPoint = matchState.pointHistory.pop();
        const stateBefore = lastPoint.stateBefore;
        const details = lastPoint.details;

        // --- Restore State ---
        matchState.teams = deepCopy(stateBefore.teams); // Restore scores
        matchState.server = stateBefore.server;
        matchState.servingTeamIndex = stateBefore.servingTeamIndex;
        matchState.isTieBreak = stateBefore.isTieBreak;
        matchState.currentSet = stateBefore.currentSet;
        matchState.currentGame = stateBefore.currentGame;
        matchState.lastGameServerId = stateBefore.lastGameServerId;
        matchState.setInitialServerId = stateBefore.setInitialServerId;
        matchState.tieBreakServerSequence = deepCopy(stateBefore.tieBreakServerSequence);
        matchState.currentTieBreakServerIndex = stateBefore.currentTieBreakServerIndex;
        matchState.matchOver = false; // Match cannot be over if we undo


        // --- Revert Stats ---
        const involvedPlayer = getPlayerById(details.involvedPlayerId);
        if (details.pointType === 'winner') {
             if(involvedPlayer.stats.winners > 0) involvedPlayer.stats.winners--;
        } else if (details.pointType === 'unforcedError') {
             if(involvedPlayer.stats.unforcedErrors > 0) involvedPlayer.stats.unforcedErrors--;
        }

         console.log("Point Undone. State restored to:", deepCopy(matchState));

        // --- Update UI ---
        updateUI();
    }

     function calculateStats() {
         // Stats are already updated incrementally in addPoint and decremented in undoLastPoint
         // This function could be used for more complex % calculations if needed
         const stats = {
             players: deepCopy(matchState.players), // Get final stats
             teamTotals: [
                 { winners: 0, unforcedErrors: 0 },
                 { winners: 0, unforcedErrors: 0 }
             ]
         };

         matchState.players.forEach(player => {
             const teamIndex = getTeamIndexByPlayerId(player.id);
             stats.teamTotals[teamIndex].winners += player.stats.winners;
             stats.teamTotals[teamIndex].unforcedErrors += player.stats.unforcedErrors;
         });

         // Example: Calculate percentages (handle division by zero)
         stats.players.forEach(player => {
              const teamIndex = getTeamIndexByPlayerId(player.id);
              const totalPointsInvolved = player.stats.winners + player.stats.unforcedErrors; // Simplistic total
               // A more accurate total points played would require tracking every point's participants

               player.stats.winnerPercentage = totalPointsInvolved > 0 ? ((player.stats.winners / totalPointsInvolved) * 100).toFixed(1) : 0;
               // Error percentage might be less meaningful on its own
         });


         return stats;
     }

     function displayStats() {
        const finalStats = calculateStats(); // Calculate final numbers
    
        // --- Display Final Score ---
        const team1Final = matchState.teams[0].score;
        const team2Final = matchState.teams[1].score;
        let resultString = `Resultado Final: ${getPlayerById(1).name}/${getPlayerById(2).name} vs ${getPlayerById(3).name}/${getPlayerById(4).name} --> `;
        resultString += `${team1Final.sets}-${team2Final.sets} Sets`;
        // Optionally add final game score of the last set if needed
        // resultString += ` (${team1Final.games}-${team2Final.games})`;
        finalResultElement.textContent = resultString;
    
        // --- Display Player Stats with Progress Bars ---
        statsDetailsElement.innerHTML = ''; // Clear previous stats
    
        // Find maximum values for scaling the bars
        let maxWinners = 0;
        let maxErrors = 0;
        finalStats.players.forEach(player => {
            if (player.stats.winners > maxWinners) maxWinners = player.stats.winners;
            if (player.stats.unforcedErrors > maxErrors) maxErrors = player.stats.unforcedErrors;
        });
        // Avoid division by zero if no winners/errors occurred
        const safeMaxWinners = maxWinners === 0 ? 1 : maxWinners;
        const safeMaxErrors = maxErrors === 0 ? 1 : maxErrors;
    
    
        finalStats.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.classList.add('player-stats');
    
            // Calculate percentage width relative to the max found
            const winnerWidthPercent = (player.stats.winners / safeMaxWinners) * 100;
            const errorWidthPercent = (player.stats.unforcedErrors / safeMaxErrors) * 100;
    
            playerDiv.innerHTML = `
                <h4>${player.name}</h4>
    
                <div class="stat-item">
                    <div class="stat-label">Winners: <span>${player.stats.winners}</span></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar winner-bar" style="width: ${winnerWidthPercent}%;"></div>
                    </div>
                </div>
    
                <div class="stat-item">
                     <div class="stat-label">Errores No Forzados: <span>${player.stats.unforcedErrors}</span></div>
                     <div class="progress-bar-container">
                         <div class="progress-bar error-bar" style="width: ${errorWidthPercent}%;"></div>
                     </div>
                 </div>
    
                <!-- Add more stats here if needed -->
            `;
            statsDetailsElement.appendChild(playerDiv);
        });
     }

    function finishMatch() {
        matchState.matchOver = true;
        console.log("Match Finished!");
        displayStats(); // Calculate and show stats
        matchScreen.classList.add('hidden');
        statsScreen.classList.remove('hidden');
    }

     function resetApplication() {
         matchState = null;
         statsScreen.classList.add('hidden');
         matchScreen.classList.add('hidden');
         setupScreen.classList.remove('hidden');
          // Optional: Clear input fields
          // playerInputs.forEach(input => input.value = '');
         pointHistoryLog.innerHTML = '<h4>Historial de Puntos (Debug)</h4>'; // Clear debug log
     }


    // --- Event Listeners ---
    startMatchBtn.addEventListener('click', () => {
        initializeMatchState();
        updateUI(); // Initial UI setup
        setupScreen.classList.add('hidden');
        matchScreen.classList.remove('hidden');
        statsScreen.classList.add('hidden');
    });

    pointButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (matchState.matchOver) return;
            const target = e.currentTarget; // Use currentTarget for delegation
            const teamWonIndex = parseInt(target.dataset.teamWon);
            const pointType = target.dataset.type;
            const playerRef = parseInt(target.dataset.playerRef); // This is the player ID (1-4) involved

            addPoint(teamWonIndex, pointType, playerRef);
        });
    });

    undoBtn.addEventListener('click', undoLastPoint);

    finishMatchBtn.addEventListener('click', () => {
         // Manually finish if needed before auto-detection
         if (!matchState.matchOver) {
             finishMatch();
         }
    });

    newMatchBtn.addEventListener('click', resetApplication);

});