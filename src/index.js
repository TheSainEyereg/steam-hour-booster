const steamUser = require("steam-user");
const rlSync = require("readline-sync");
const {steamLogin, steamPassword, appIDs} = require("./config.json");

const client = new steamUser();

client.logOn({
	accountName: steamLogin,
	password: steamPassword
});

client.on("loggedOn", () => {
	console.log(`Logged in as ${steamLogin} (https://steamcommunity.com/profiles/${client.steamID})`);
	client.setPersona(steamUser.EPersonaState.Online);
	client.gamesPlayed(appIDs);
	console.log(`Playing games: ${appIDs.join(", ")}`);
});

client.on("steamGuard", (d, callback) => {
	console.log(`SteamGuard required for ${steamLogin}`);
	callback(rlSync.question("Steam Guard code: "));
});

client.on("disconnected", (e,msg) => console.log(`Disconnected from Steam, reconnecting...`));

client.on("error", (e) => {
	console.log(`Error while logging in as ${steamLogin} (${e})`);
	process.exit(1);
});