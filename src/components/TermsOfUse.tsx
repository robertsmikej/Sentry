import { APP_NAME } from '../constants/app';

interface TermsOfUseProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsOfUse({ isOpen, onClose }: TermsOfUseProps) {
  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[90vh]">
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle absolute right-2 top-2"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="font-bold text-xl mb-4 pr-8">Terms of Use</h2>

        <div className="prose prose-sm max-w-none text-base-content/80 space-y-4 overflow-y-auto">
          <p className="text-sm text-base-content/60">Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">1. Acceptance of Terms</h3>
            <p>By using {APP_NAME}, you agree to these Terms of Use. If you do not agree, please do not use this application.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">2. Intended Use</h3>
            <p>{APP_NAME} is designed for legitimate community safety purposes, including:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Neighborhood watch activities</li>
              <li>Personal record-keeping of vehicle encounters</li>
              <li>Tracking your own vehicles or those of family members with consent</li>
              <li>Assisting law enforcement when requested (by providing your own records)</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">3. Prohibited Uses</h3>
            <p className="font-semibold text-error">You may NOT use {APP_NAME} to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong>Stalk or harass</strong> any individual</li>
              <li><strong>Track individuals</strong> without their knowledge or consent</li>
              <li><strong>Discriminate</strong> against any person or group</li>
              <li><strong>Engage in vigilante activities</strong> or confront individuals</li>
              <li><strong>Submit false flags</strong> or maliciously mark plates as suspicious</li>
              <li><strong>Facilitate domestic abuse</strong> or control of partners/family members</li>
              <li><strong>Violate any local, state, or federal laws</strong></li>
            </ul>
            <div className="alert alert-error text-sm mt-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Misuse of this application may violate criminal laws including stalking statutes, harassment laws, and privacy regulations.</span>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">4. User Responsibilities</h3>
            <p>When using {APP_NAME}, you agree to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong>Verify information independently</strong> before taking any action</li>
              <li><strong>Report concerns to authorities</strong> rather than confronting individuals</li>
              <li><strong>Protect your database access</strong> and only share with trusted individuals</li>
              <li><strong>Keep flags accurate</strong> and remove outdated or incorrect information</li>
              <li><strong>Respect others' privacy</strong> and use data responsibly</li>
              <li><strong>Comply with all applicable laws</strong> in your jurisdiction</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">5. Shared Database Conduct</h3>
            <p>If you use or contribute to a shared database:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>You are responsible for the accuracy of data you submit</li>
              <li>Do not submit flags based on personal grudges, discrimination, or vendettas</li>
              <li>Other users' flags are unverified - treat them as informational only</li>
              <li>The database owner may remove your access for violations</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">6. No Warranty</h3>
            <p>{APP_NAME} is provided "as is" without warranties of any kind. We do not guarantee:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Accuracy of OCR or AI recognition</li>
              <li>Accuracy of user-submitted flags or information</li>
              <li>Availability or reliability of sync services</li>
              <li>That the app will meet your specific needs</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">7. Limitation of Liability</h3>
            <p>To the maximum extent permitted by law, the developers and contributors of {APP_NAME} shall not be liable for any damages arising from:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Use or misuse of the application</li>
              <li>Inaccurate data or recognition results</li>
              <li>Actions taken based on information from the app</li>
              <li>Data loss or security breaches</li>
              <li>Third-party services (Google Sheets, Gemini AI)</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">8. Legal Compliance</h3>
            <p>License plate tracking laws vary by jurisdiction. You are responsible for:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Understanding and complying with local privacy laws</li>
              <li>Understanding ALPR (Automatic License Plate Recognition) regulations in your area</li>
              <li>Obtaining any necessary permissions or notifications</li>
              <li>Understanding GDPR, CCPA, or other applicable privacy regulations</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">9. Termination</h3>
            <p>We reserve the right to terminate access to shared community databases for users who violate these terms. You may stop using the application at any time.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">10. Changes to Terms</h3>
            <p>We may update these terms from time to time. Continued use of the application after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">11. Contact</h3>
            <p>For questions about these terms, please open an issue on our GitHub repository.</p>
          </section>
        </div>

        <div className="modal-action mt-4">
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
