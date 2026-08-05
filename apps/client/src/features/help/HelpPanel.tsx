// ============================================================================
// HELP PANEL
// ============================================================================
// The body of the in-app manual. Shared verbatim by the desktop header
// popover and the mobile tool-sheet entry, so a phone gets the same manual
// rather than a trimmed one.
//
// Every topic is collapsed on open: the panel is a lookup ("how do I hide an
// NPC?"), not something to read top to bottom, and eight expanded topics would
// bury the list of topics itself.

import React, { useState } from "react";
import { HELP_LINKS, HELP_TOPICS } from "./helpTopics";

export const HelpPanel: React.FC = () => {
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  return (
    <div className="help-panel">
      <p className="help-panel__intro">
        Pick a topic. Everything here is also in the full guides, with screenshots.
      </p>

      <ul className="help-panel__topics">
        {HELP_TOPICS.map((topic) => {
          const expanded = openTopic === topic.id;
          return (
            <li key={topic.id}>
              <button
                type="button"
                className="help-panel__topic-button"
                onClick={() => setOpenTopic(expanded ? null : topic.id)}
                aria-expanded={expanded}
              >
                <span aria-hidden="true">{topic.icon}</span>
                <span className="help-panel__topic-title">{topic.title}</span>
                <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
              </button>

              {expanded && (
                <dl className="help-panel__entries">
                  {topic.entries.map((entry) => (
                    <div key={entry.term} className="help-panel__entry">
                      <dt>{entry.term}</dt>
                      <dd>{entry.detail}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <div className="help-panel__links">
        <strong className="help-panel__links-heading">The full guides</strong>
        {HELP_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="help-panel__link"
          >
            <span className="help-panel__link-label">{link.label} ↗</span>
            <span className="help-panel__link-detail">{link.detail}</span>
          </a>
        ))}
      </div>
    </div>
  );
};
