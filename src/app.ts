import { EPersonaState } from "steam-user";
import MySteamUser from "./Client";
import { getAccountAppIDs, getAllAccounts } from "./database";
import { addAccounts, startListeningForKeypress } from "./prompts";

process.stdin.resume();

const users = new Map<string, MySteamUser>();

(async () => {
	const dbAccounts = getAllAccounts();

	if (!dbAccounts.length) {
		console.log("No accounts found! Need to add them first");
		await addAccounts(users);
	} else {
		for (const account of dbAccounts) {
			const appIDs = getAccountAppIDs(account.steamID);

			const user = new MySteamUser();

			user.on("loggedOn", () => {
				user.setPersona(EPersonaState.Online);
				user.gamesPlayed(appIDs.map(Number));
			});

			const { accountName, refreshToken } = account;

			user.logOn({ refreshToken, accountName });

			users.set(account.steamID, user);
		}

		console.log(`Successfully connected to ${users.size} accounts`);
	}

	startListeningForKeypress(users);
})();

// function handleInterrupt(code: number) {
// 	process.removeAllListeners();

// 	console.log(`Exiting with code: ${code}`);

// 	process.exit(code);
// }

// process.once("exit", handleInterrupt);
// process.once("SIGINT", handleInterrupt);
// process.once("SIGQUIT", handleInterrupt);
// process.once("SIGTERM", handleInterrupt);