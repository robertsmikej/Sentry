import { useState, useEffect } from 'react';
import type { LookupEntry, Experience } from '../types';

interface PlateEditorProps {
  plate?: LookupEntry;
  plateCode: string;
  onSave: (entry: LookupEntry) => void;
  onCancel: () => void;
}

export function PlateEditor({ plate, plateCode, onSave, onCancel }: PlateEditorProps) {
  const [name, setName] = useState(plate?.name || '');
  const [description, setDescription] = useState(plate?.description || '');
  const [experience, setExperience] = useState<Experience>(plate?.experience || 'neutral');

  useEffect(() => {
    if (plate) {
      setName(plate.name || '');
      setDescription(plate.description || '');
      setExperience(plate.experience || 'neutral');
    }
  }, [plate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const entry: LookupEntry = {
      code: plateCode,
      name,
      description,
      experience,
      seenCount: plate?.seenCount || 1,
      lastSeen: new Date(),
      isLocal: true,
    };

    onSave(entry);
  };

  const isNew = !plate;

  return (
    <div className="card bg-base-200 w-full max-w-md">
      <form onSubmit={handleSubmit} className="card-body p-4">
        <h3 className="card-title">
          {isNew ? 'Add New Plate' : 'Edit Plate'}
        </h3>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Plate Code</span>
          </label>
          <input
            type="text"
            value={plateCode}
            disabled
            className="input input-bordered font-mono"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Name / Label</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Blue Honda Civic, Neighbor's car"
            className="input input-bordered"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Notes</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any notes about this plate..."
            className="textarea textarea-bordered h-24"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Experience (optional)</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setExperience(experience === 'good' ? 'neutral' : 'good')}
              className={`btn btn-lg flex-1 min-h-[56px] gap-2 ${
                experience === 'good'
                  ? 'btn-success'
                  : 'btn-outline hover:btn-success hover:btn-outline'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
              </svg>
              Good
            </button>
            <button
              type="button"
              onClick={() => setExperience(experience === 'bad' ? 'neutral' : 'bad')}
              className={`btn btn-lg flex-1 min-h-[56px] gap-2 ${
                experience === 'bad'
                  ? 'btn-error'
                  : 'btn-outline hover:btn-error hover:btn-outline'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />
              </svg>
              Bad
            </button>
          </div>
          <p className="text-xs text-base-content/50 mt-2 text-center">
            Tap to select, tap again to clear
          </p>
          {experience === 'bad' && (
            <div className="alert alert-warning text-xs mt-3 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>If using a shared database, this flag will be visible to others. Only flag for legitimate safety concerns.</span>
            </div>
          )}
        </div>

        {plate && (
          <div className="text-sm text-base-content/60 mt-2">
            <p>Seen {plate.seenCount || 1} time{(plate.seenCount || 1) !== 1 ? 's' : ''}</p>
            {plate.lastSeen && (
              <p>Last seen: {new Date(plate.lastSeen).toLocaleString()}</p>
            )}
          </div>
        )}

        <div className="card-actions flex-col gap-2 mt-4">
          <button type="submit" className="btn btn-primary btn-lg w-full min-h-[56px]">
            {isNew ? 'Add Plate' : 'Save Changes'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-ghost w-full min-h-[48px]">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
