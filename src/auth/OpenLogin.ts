import { Keypair } from "@solana/web3.js";
import { get } from "@toruslabs/http-helpers";
import OpenLogin from "@toruslabs/openlogin";
import { getED25519Key } from "@toruslabs/openlogin-ed25519";
import { subkey } from "@toruslabs/openlogin-subkey";
import { Mutex } from "async-mutex";
import base58 from "bs58";
import log from "loglevel";

import config from "@/config";
import { APPLE, ProjectAccountType } from "@/utils/enums";
import { generateTorusAuthHeaders } from "@/utils/helpers";

class OpenLoginFactory {
  private static instance: OpenLogin;

  private static mutex = new Mutex();

  public static async getInstance(reinitialize = false): Promise<OpenLogin> {
    const releaseLock = await this.mutex.acquire();
    try {
      if (!OpenLoginFactory.instance) {
        const instance = new OpenLogin({
          clientId: config.openLoginClientId,
          network: config.torusNetwork,
          whiteLabel: config.openLoginWhiteLabel,
          redirectUrl: `${config.baseRoute}end`,
          replaceUrlOnRedirect: true,
          uxMode: "redirect",
          originData: {
            [window.location.origin]: config.openLoginOriginSig as string,
          },
          sessionTime: 3 * 86400,
        });
        await instance.init();

        OpenLoginFactory.instance = instance;
      }
      if (reinitialize) {
        await OpenLoginFactory.instance.init();
      }
    } catch (error) {
      log.error(error, "Unable to create openlogin instance");
      throw error;
    } finally {
      releaseLock();
    }
    return OpenLoginFactory.instance;
  }

  public static async computeAccount() {
    const openLoginInstance = await OpenLoginFactory.getInstance();
    if (!openLoginInstance || !openLoginInstance.state.sessionId) {
      throw new Error("Openlogin instance/session not found");
    }

    const openLoginState = openLoginInstance.state;
    const { privKey, tKey, oAuthPrivateKey } = openLoginState;

    if (!privKey) {
      throw new Error("Login unsuccessful");
    }

    const userInfo = openLoginInstance.getUserInfo();

    const { sk: secretKey } = getED25519Key(privKey.padStart(64, "0"));
    const typeOfLoginDisplay = userInfo.typeOfLogin.charAt(0).toUpperCase() + userInfo.typeOfLogin.slice(1);
    const accountDisplay = (userInfo.typeOfLogin !== APPLE && userInfo.email) || userInfo.name;
    const mainKeyPair = Keypair.fromSecretKey(secretKey);
    const accounts: ProjectAccountType[] = [];
    accounts.push({
      app: `${typeOfLoginDisplay} ${accountDisplay}`,
      solanaPrivKey: base58.encode(mainKeyPair.secretKey),
      privKey,
      name: `Solana Wallet ${window.location.origin}`,
      address: `${mainKeyPair.publicKey.toBase58()}`,
    });

    // derive app scoped keys from tkey
    const userDapps: Record<string, string> = {};

    // let matchedDappHost = -1;
    let matchedDappHost = 0;
    const dappOrigin = sessionStorage.getItem("dappOrigin") || "https://solana.tor.us";
    const dappHost = new URL(dappOrigin);

    if (tKey && oAuthPrivateKey) {
      try {
        // projects are stored on oAuthPrivateKey but subkey is derived from tkey

        const headers = generateTorusAuthHeaders(oAuthPrivateKey);
        log.info(headers, "headers");
        const response = await get<{ user_projects: [{ last_login: string; project_id: string; hostname: string; name: string }] }>(
          `${config.developerDashboardUrl}/projects/user-projects?chain_namespace=solana`,
          {
            headers,
          }
        );
        log.info(response, "User projects from developer dashboard");
        const userProjects = response.user_projects ?? [];
        userProjects.sort((a, b) => (a.last_login < b.last_login ? 1 : -1));
        userProjects.forEach((project, idx) => {
          const subKey = subkey(tKey, Buffer.from(project.project_id, "base64"));
          const paddedSubKey = subKey.padStart(64, "0");
          const { sk } = getED25519Key(paddedSubKey);
          const keyPair = Keypair.fromSecretKey(sk);
          userDapps[keyPair.publicKey.toBase58()] = `${project.name} (${project.hostname})`;
          accounts.push({
            app: `${project.name}`,
            solanaPrivKey: base58.encode(keyPair.secretKey),
            privKey: paddedSubKey,
            name: `${project.name} (${project.hostname})`,
            address: keyPair.publicKey.toBase58(),
          });

          // eslint-disable-next-line no-console
          console.log(project);
          if (dappHost.host === project.hostname) matchedDappHost = idx + 1;
        });
      } catch (error2: unknown) {
        log.error("Failed to derive app-scoped keys", error2);
      }
    }

    return {
      accounts,
      userDapps,
      matchedDappHost,
    };
  }
}
export default OpenLoginFactory;
