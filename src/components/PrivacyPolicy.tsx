import { APP_NAME } from '../constants/app';

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
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

        <h2 className="font-bold text-xl mb-4 pr-8">Privacy Policy</h2>

        <div className="prose prose-sm max-w-none text-base-content/80 space-y-4 overflow-y-auto">
          <p className="text-sm text-base-content/60">Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">1. Information We Collect</h3>
            <p>{APP_NAME} collects and stores the following information locally on your device:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>License plate numbers you scan or manually enter</li>
              <li>Names, notes, and experience ratings you add to plates</li>
              <li>Encounter timestamps and frequency data</li>
              <li>GPS location data (if you enable location tracking)</li>
              <li>Photos you capture (processed locally, not stored permanently)</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">2. How Your Data is Stored</h3>
            <p><strong>Local Storage:</strong> All data is stored locally on your device using IndexedDB. This data remains on your device unless you choose to sync it.</p>
            <p><strong>Google Sheets Sync:</strong> If you configure sync, your data is sent to the Google Sheets URL you provide. If using a shared database, your data will be visible to others with access to that spreadsheet.</p>
            <p><strong>Gemini AI:</strong> If you enable Gemini recognition, images are sent to Google's servers for processing. Google's privacy policy applies to this data.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">3. Location Data</h3>
            <p>Location tracking is optional. When enabled:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>GPS coordinates are captured when you scan a plate</li>
              <li>You can choose precision level: exact, neighborhood (~100m), or city (~1km)</li>
              <li>Location data is stored with encounter records</li>
              <li>If syncing to a shared database, location data may be visible to others</li>
            </ul>
            <p>You can disable location tracking at any time in Settings.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">4. Data Sharing</h3>
            <p>We do not sell or share your data with third parties. However:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>If you use a shared community database, your data is shared with other users of that database</li>
              <li>If you share your database link, recipients can view and edit the data</li>
              <li>Google may process data according to their privacy policies if you use Sheets sync or Gemini AI</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">5. Data Retention</h3>
            <p>Data is retained until you delete it. You can:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Delete individual plates or encounters from the app</li>
              <li>Clear all local data by clearing your browser's site data</li>
              <li>Export your data as CSV files for backup</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">6. Your Rights</h3>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Access all data stored about you (it's on your device)</li>
              <li>Export your data at any time</li>
              <li>Delete your data at any time</li>
              <li>Disable location tracking</li>
              <li>Use the app without syncing to external services</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">7. Security</h3>
            <p>Your data is stored locally on your device and is as secure as your device itself. If you sync to Google Sheets, that data is protected by Google's security measures and your Google account settings.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">8. Children's Privacy</h3>
            <p>{APP_NAME} is not intended for use by children under 13. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">9. Changes to This Policy</h3>
            <p>We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mt-4 mb-2">10. Contact</h3>
            <p>For questions about this privacy policy, please open an issue on our GitHub repository.</p>
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
