/** Formal employer name; shortens to "Cisco" below the `sm` breakpoint. */
export default function CiscoName() {
  return (
    <>
      <span className="sm:hidden">Cisco</span>
      <span className="hidden sm:inline">Cisco Systems Inc.</span>
    </>
  );
}

export const CISCO_FULL = 'Cisco Systems Inc.';
export const CISCO_SHORT = 'Cisco';
