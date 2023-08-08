import prompts from "prompts";
import { EAuthSessionGuardType, EAuthTokenPlatformType, EResult, LoginSession } from "steam-session";
import MySteamUser from "./Client";
import { addAccountAppIDs, deleteAccount as deleteDBAccount, deleteAccountAppIDs, getAccountAppIDs, getAllAccounts, saveNewAccount, updateAccountRrefreshToken } from "./database";

export async function addAccounts(usersMap: Map<string, MySteamUser>) {
	do {
		const user = new MySteamUser();
		try {
			await authAccount(user);
		} catch (e) {
			console.log(`Failed to authenticate account! (${e})`);
			continue;
		}

		saveNewAccount(
			user.steamID!.toString(),
			user.getAccountName()!,
			user.getRefreshToken()!,
			[]
		);
		usersMap.set(user.steamID!.toString(), user);

		await addAppIDs(user);

	} while ((await prompts({
		type: "confirm",
		name: "value",
		message: "Add another account?",
		initial: true
	})).value);
}

async function authAccount(user: MySteamUser) {
	// Only for checking if account exists
	const allNames = getAllAccounts().map(({ accountName }) => accountName);

	const accountName = (await prompts({
		type: "text",
		name: "value",
		message: "Account name"
	})).value;

	if (!accountName) throw new Error("Aborted!");
	
	if (allNames.includes(accountName) && user.getAccountName() !== accountName) throw new Error(`Account with name ${accountName} already exists!`);

	const password = (await prompts({
		type: "password",
		name: "value",
		message: "Password"
	})).value;

	if (!password) throw new Error("Aborted!");

	const session = new LoginSession(EAuthTokenPlatformType.SteamClient);
	const res = await session.startWithCredentials({ accountName, password });

	if (res.actionRequired) {
		const noCodeActionsTypes = [EAuthSessionGuardType.EmailConfirmation, EAuthSessionGuardType.DeviceConfirmation];
		const noCodeActions = res.validActions!.filter(({ type }) => noCodeActionsTypes.includes(type));
		const codeActions = res.validActions!.filter(({ type }) => !noCodeActionsTypes.includes(type));

		// for (const action of [...noCodeActions, ...codeActions]) {}
		const action = [...noCodeActions, ...codeActions][0];

		if ([EAuthSessionGuardType.EmailConfirmation, EAuthSessionGuardType.DeviceConfirmation].includes(action.type)) {
			console.log(action.type === EAuthSessionGuardType.DeviceConfirmation ? "Confirm this login in Steam mobile app" : "Confirm this login by email");
		
			// TODO: Handle ctrl+c like in other prompts
		} else {
			console.log(action.type === EAuthSessionGuardType.DeviceCode ? "Code from your Guard Mobile Authenticator is required" : `A login code has been sent to your email address at ${action.detail}`);
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const code = (await prompts({
					type: "text",
					name: "value",
					message: "Steam Guard code"
				})).value;

				if (!code) throw new Error("Aborted!");

				try {
					await session.submitSteamGuardCode(code);
					break;
				} catch (e) {
					const { eresult } = e as { eresult?: EResult };
					if (eresult === EResult.TwoFactorCodeMismatch || eresult === EResult.InvalidLoginAuthCode) {
						console.log("Incorrect Steam Guard code!");
						continue;
					}

					throw e;
				}
			}
		}
	}

	await new Promise<void>((resolve, reject) => {
		session.once("authenticated", () => {
			const { refreshToken } = session;

			user.logOn({ refreshToken, accountName });

			user.once("error", reject);
			user.once("loggedOn", () => {
				session.off("timeout", reject);
				session.off("error", reject);
				user.off("error", reject);
				resolve();
			});
		});

		session.once("timeout", reject);
		session.once("error", reject);
	});
}

async function addAppIDs(user: MySteamUser) {
	const gameIDs = (await prompts({
		type: "list",
		name: "value",
		message: "Enter game IDs separated with a comma",
		initial: "",
		separator: ","
	})).value as string[] | undefined;

	if (typeof gameIDs === "undefined") return;

	addAccountAppIDs(user.steamID!.toString(), gameIDs);
	user.gamesPlayed(gameIDs.map(Number));
}

async function deleteAppIDs(user: MySteamUser) {
	const ids = getAccountAppIDs(user.steamID!.toString());

	const gameIDs = (await prompts({
		type: "multiselect",
		name: "value",
		message: "Select app IDs to delete",
		choices: ids.map(id => ({ value: id, title: id })),
		hint: "- Space to select. Return to submit"
	})).value as string[] | undefined;

	if (typeof gameIDs === "undefined") return;

	deleteAccountAppIDs(user.steamID!.toString(), gameIDs);
	user.gamesPlayed(gameIDs.map(Number));
}

function prepareAccountList(usersMap: Map<string, MySteamUser>) {
	const allAccounts = getAllAccounts();

	return allAccounts.map(acc => ({
		title: `${usersMap.get(acc.steamID!)?.isConnected() ? "🟢" : "🔴"} ${acc.accountName} (https://steamcommunity.com/profiles/${acc.steamID!})`,
		value: acc.steamID
	}));
}

function deleteAccount(usersMap: Map<string, MySteamUser>, id: string) {
	deleteDBAccount(id);
	const user = usersMap.get(id)!;
	usersMap.delete(id);

	// if you want to wait until user is disconnected
	if (user.isConnected()) return new Promise<void>(resolve => {
		user.logOff();
		user.once("disconnected", () => resolve());
	});
}

async function deleteAccounts(usersMap: Map<string, MySteamUser>) {
	const ids = (await prompts({
		type: "multiselect",
		name: "value",
		message: "Select accounts",
		choices: prepareAccountList(usersMap),
		hint: "- Space to select. Return to submit"
	})).value as string[] | undefined;

	if (!ids) return;

	for (const id of ids) deleteAccount(usersMap, id);
}
async function editAccount(user: MySteamUser) {
	const appIDs = user.isConnected() ? getAccountAppIDs(user.steamID!.toString()) : [];

	const options: { title: string, disabled?: boolean, callback: (user: MySteamUser) => Promise<void> | void }[] = [
		{ title: "LogOff", callback: user.logOff, disabled: !user.isConnected() },
		{ title: "ReLogIn", callback: user.relogOn, disabled: user.isConnected() },
		{ title: "Authenticate (update token)", callback: async () => {
			try {
				await authAccount(user);
			} catch (e) {
				console.log(`Failed to authenticate account! (${e})`);
				return;
			}
			updateAccountRrefreshToken(user.steamID!.toString(), user.getRefreshToken()!);
		} },
		{ title: "Add app IDs", callback: addAppIDs, disabled: !user.isConnected() },
		{ title: "Delete app IDs", callback: deleteAppIDs, disabled: !appIDs.length },
	].filter(({ disabled }) => !disabled);

	const selected = (await prompts({
		type: "select",
		name: "value",
		message: "Menu",
		choices: options.map(({ title }) => ({ title })),
		initial: 0
	})).value as number | undefined;

	if (typeof selected === "undefined") return;

	const callback = options[selected].callback;
	if (callback) await callback(user);
}

async function editAccounts(usersMap: Map<string, MySteamUser>) {
	const id = (await prompts({
		type: "select",
		name: "value",
		message: "Select accounts",
		choices: prepareAccountList(usersMap),
	})).value as string | undefined;

	if (!id) return;

	await editAccount(usersMap.get(id)!);
}

async function showMenu(usersMap: Map<string, MySteamUser>) {
	const options: { title: string, disabled?: boolean, callback: (usersMap: Map<string, MySteamUser>) => Promise<void> | void }[] = [
		{ title: "Exit", callback: () => process.exit(0) },
		{ title: "Edit account", callback: editAccounts, disabled: !usersMap.size },
		{ title: "Add multiple accounts", callback: addAccounts },
		{ title: "Delete multiple accounts", callback: deleteAccounts, disabled: !usersMap.size },
	].filter(({ disabled }) => !disabled);

	const selected = (await prompts({
		type: "select",
		name: "value",
		message: "Menu",
		choices: options.map(({ title }) => ({ title })),
		initial: 0
	})).value as number | undefined;

	if (typeof selected === "undefined") return;

	const callback = options[selected].callback;
	if (callback) await callback(usersMap);
}

let isHandling = false;
export async function startListeningForKeypress(usersMap: Map<string, MySteamUser>) {
	if (isHandling) throw new Error("Already handling menu, something is wrong with your code");
	isHandling = true;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		await showMenu(usersMap);
	}
}