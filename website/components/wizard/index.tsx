import React, { useState } from "react";
import * as Styled from "./styled";
import { Container } from "../layout";
import { Dropdown } from "../dropdown";
import { InstallScriptService, InstallScriptType } from "../../services/install-script";
import { Button } from "../button";
import { SessionKeys, SessionService } from "../../services/session";
import { Script } from "../script";
import { TunshellClient } from "../tunshell-client";
import { LocationService, RELAY_SERVERS, RelayServer } from "../../services/location";
import { WebUrlService } from "../../services/direct-web-url";
import Link from "next/link";

const scriptService = new InstallScriptService();
const localOptions = InstallScriptService.getOptions(InstallScriptType.Local);
const targetOptions = InstallScriptService.getOptions(InstallScriptType.Target);

const locationService = new LocationService();

const sessionService = new SessionService();

const urlService = new WebUrlService();

enum State {
  Initial,
  CreatingSession,
  CreatedSession,
  Failed,
}

export const Wizard = () => {
  const [state, setState] = useState<State>(State.Initial);
  const [relayLocation, setRelayLocation] = useState<string>("auto");
  const [localHostType, setLocalHostType] = useState<string>();
  const [targetHostType, setTargetHostType] = useState<string>();
  const [session, setSession] = useState<SessionKeys>();
  const [showWebTerm, setShowWebTerm] = useState(false);

  const canGenerateSession = Boolean(state === State.Initial && localHostType && targetHostType);

  const getRelayServer = async (): Promise<RelayServer> => {
    if (relayLocation === "auto") {
      return await locationService.findNearestRelayServer();
    } else {
      return RELAY_SERVERS.find((i) => i.domain === relayLocation);
    }
  };

  const generateSession = async () => {
    try {
      setState(State.CreatingSession);
      setSession(await sessionService.createSessionKeys(await getRelayServer()));
      setState(State.CreatedSession);
    } catch (e) {
      console.warn(`Failed to create a session: `, e);
      setState(State.Failed);
    }
  };

  return (
    <Styled.Wizard>
      <Container>
        <Styled.Dialog>
          <Styled.StepHeader>
            <Styled.StepNumber>1</Styled.StepNumber>
            Select your environments
          </Styled.StepHeader>

          <Styled.Environments>
            <Styled.Environment>
              <h3>Local</h3>
              <p>Platform you have shell access to.</p>

              <Styled.Dropdown>
                <Dropdown onSelect={(i) => setLocalHostType(i)}>
                  <option value="" data-placeholder>
                    Select
                  </option>
                  {localOptions.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                  <option value="browser">This browser</option>
                </Dropdown>
              </Styled.Dropdown>
            </Styled.Environment>
            <Styled.Separator />
            <Styled.Environment>
              <h3>Target</h3>
              <p>Platform you want to remote into.</p>
              <Styled.Dropdown>
                <Dropdown onSelect={(i) => setTargetHostType(i)}>
                  <option value="" data-placeholder>
                    Select
                  </option>
                  {targetOptions.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                </Dropdown>
              </Styled.Dropdown>
            </Styled.Environment>
          </Styled.Environments>

          <Styled.RelayLocation>
            <label>Location:</label>
            <Dropdown inline onSelect={(i) => setRelayLocation(i)} disabled={!!session}>
              <option value="auto">Auto</option>
              {RELAY_SERVERS.map((i) => (
                <option key={i.domain} value={i.domain}>
                  {i.label}
                </option>
              ))}
            </Dropdown>
          </Styled.RelayLocation>
        </Styled.Dialog>

        <Styled.Dialog>
          <Styled.StepHeader>
            <Styled.StepNumber>2</Styled.StepNumber>

            {state !== State.CreatedSession ? (
              <>
                <Button mode="inverted" onClick={() => generateSession()} disabled={!canGenerateSession}>
                  {state === State.CreatingSession ? "Generating session..." : "Generate session"}
                </Button>
              </>
            ) : (
              <span>Install the client</span>
            )}
          </Styled.StepHeader>

          {state === State.Failed && (
            <Styled.Error>
              An error occurred while calling the Tunshell API, please try again later. <br />
              If this issue persist please create a ticket{" "}
              <a href="https://github.com/TimeToogo/tunshell/issues" target="_blank" rel="noopener noreferrer">
                here
              </a>
              .
            </Styled.Error>
          )}

          {state === State.CreatedSession && (
            <Styled.Environments>
              <Styled.Environment>
                {localHostType === "browser" ? (
                  <>
                    <p>Start the client in your browser.</p>
                    <Styled.LaunchShell>
                      <Button mode="inverted" onClick={() => setShowWebTerm(true)}>
                        Launch Shell
                      </Button>
                      <Styled.LaunchShellLink target="_blank" href={urlService.createWebUrl(session)}>Shareable Link</Styled.LaunchShellLink>
                    </Styled.LaunchShell>
                  </>
                ) : (
                  <>
                    <p>Run this script on your local host.</p>

                    <Script
                      lang={InstallScriptService.getScript(InstallScriptType.Local, localHostType).lang}
                      script={scriptService.renderInstallScript(InstallScriptType.Local, localHostType, session)}
                    />
                  </>
                )}
              </Styled.Environment>
              <Styled.Separator />
              <Styled.Environment>
                <p>Run this script on the target host.</p>

                <Script
                  lang={InstallScriptService.getScript(InstallScriptType.Target, targetHostType).lang}
                  script={scriptService.renderInstallScript(InstallScriptType.Target, targetHostType, session)}
                />
              </Styled.Environment>
            </Styled.Environments>
          )}
        </Styled.Dialog>
      </Container>

      {showWebTerm && <TunshellClient session={session} onClose={() => setShowWebTerm(false)} />}
    </Styled.Wizard>
  );
};
