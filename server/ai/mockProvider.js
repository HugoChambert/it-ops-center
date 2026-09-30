// Rule-based stand-in for a real AI provider. Same input/output shape as any future provider.
const RULES = [
  { match: /vpn|certificate|tunnel/, cause: 'Potential VPN authentication or certificate issue, or the VPN gateway may be unreachable.',
    steps: ['Verify the user has general network connectivity', 'Verify the VPN gateway is reachable and running', 'Check the VPN client logs for authentication errors', 'Verify the account is enabled and the password is current', 'Check whether the client certificate has expired'],
    commands: [['Test the VPN gateway port', 'Test-NetConnection vpn.company.local -Port 443'], ['List the user\'s certificates', 'Get-ChildItem Cert:\\CurrentUser\\My']], query: 'vpn' },
  { match: /database|replica|replication|sql|query/, cause: 'Possible resource pressure on the database host or a network delay between primary and replica.',
    steps: ['Check CPU, memory and disk on the database host', 'Check network latency between primary and replica', 'Review the database error log for replication errors', 'Look for long-running queries or large batch jobs', 'Confirm backups or maintenance jobs are not running'],
    commands: [['Check free disk space', 'Get-Volume'], ['Check CPU load', 'Get-Counter "\\Processor(_Total)\\% Processor Time"']], query: 'database' },
  { match: /drive|file share|shared|storage|disk|folder/, cause: 'Possibly a nearly full volume, a busy file server, or a network problem between the user and the server.',
    steps: ['Check free space on the file server volumes', 'Check the number of active SMB sessions', 'Test connectivity from the user\'s machine to the file server', 'Check for antivirus scans or backups running on the server', 'Ask whether other users see the same slowness'],
    commands: [['Check volume free space', 'Get-Volume'], ['List open SMB sessions', 'Get-SmbSession'], ['Test the file share port', 'Test-NetConnection file-01 -Port 445']], query: 'file' },
  { match: /mail|email|mailbox|quota|outlook/, cause: 'Potentially a mailbox over its size limit, or a mail flow problem.',
    steps: ['Check the mailbox size against its quota', 'Confirm the user\'s account is enabled', 'Test connectivity to the mail server', 'Check the mail queue for stuck messages', 'Ask the user for the exact error message they see'],
    commands: [['Check mailbox size', 'Get-MailboxStatistics -Identity user@company.local'], ['Test the mail server port', 'Test-NetConnection mail-01 -Port 25']], query: 'mail' },
  { match: /password|login|locked|account|sign in|log in/, cause: 'Possibly a locked account, an expired password, or a problem reaching the directory service.',
    steps: ['Check whether the account is locked or disabled', 'Check the password expiry date', 'Confirm the user is typing the right username and domain', 'Check for repeated failed sign-ins from another device', 'Verify the domain controller is reachable'],
    commands: [['Check lock and password status', 'Get-ADUser -Identity username -Properties LockedOut,PasswordExpired']], query: 'password' },
];
const GENERIC = { cause: 'The cause is not clear from the description alone. More information is needed.',
  steps: ['Ask the user for the exact error message and when it started', 'Check whether other users or systems are affected', 'Check recent changes such as updates or configuration edits', 'Review system event logs around the time of the problem', 'Check the health of the affected system'],
  commands: [['Review recent system events', 'Get-WinEvent -LogName System -MaxEvents 50'], ['Check running services', 'Get-Service | Where-Object Status -ne Running']], query: '' };

export const mockProvider = {
  name: 'mock',
  async troubleshoot(incident) {
    const text = `${incident.title} ${incident.description || ''}`.toLowerCase();
    const r = RULES.find((x) => x.match.test(text)) || GENERIC;
    return {
      provider: 'mock', confidence: 'low',
      disclaimer: 'AI-assisted recommendation. This is not a confirmed diagnosis. Verify each step before acting.',
      possibleCause: r.cause, investigation: r.steps,
      commands: r.commands.map(([label, command]) => ({ label, command })), articleQuery: r.query,
    };
  },
  // Builds a draft from recorded facts only. It does not guess a root cause; the technician fills that in.
  async draftReport(incident) {
    const actions = incident.events.filter((e) => e.type === 'action').map((e) => e.message);
    const TBC = 'To be confirmed by the technician.';
    return {
      provider: 'mock',
      problem: [incident.title, incident.description].filter(Boolean).join('. '),
      impact: `Priority: ${incident.priority}. Affected system: ${incident.system || 'not recorded'}. Affected user: ${incident.affected_user || 'not recorded'}.`,
      investigation: actions.length ? actions.map((a, n) => `${n + 1}. ${a}`).join('\n') : 'No troubleshooting actions were recorded.',
      root_cause: TBC,
      resolution: incident.resolution || 'Not yet resolved.',
      preventative_action: TBC,
    };
  },
};
