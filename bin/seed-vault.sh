#!/usr/bin/env bash
# Seed test vault with sample notes representative of a real Obsidian vault
set -euo pipefail

# Expand ~ in path
VAULT_ARG="${1:-$HOME/obsidian-test-vault}"
VAULT="${VAULT_ARG/#\~/$HOME}"

echo "Seeding test vault at $VAULT..."

# Create folder structure
mkdir -p "$VAULT"/{Daily,Projects,Meetings,Reference,Archive,Templates}
mkdir -p "$VAULT/Projects/Website Redesign"
mkdir -p "$VAULT/Projects/Q1 Planning"

# Daily notes
cat > "$VAULT/Daily/2024-01-15.md" << 'EOF'
# Monday, January 15, 2024

## Tasks
- [x] Review project proposal
- [ ] Send follow-up emails
- [ ] Update documentation
- [ ] Schedule team sync

## Notes
Had a productive morning. Met with Sarah about the [[Website Redesign]] project.

Key decisions:
- Launch date moved to March
- Budget approved for new hosting
- Need to hire contractor for frontend work

## Links
- [[Meeting Notes - Website Kickoff]]
- [[Q1 Planning]]

#daily #work
EOF

cat > "$VAULT/Daily/2024-01-16.md" << 'EOF'
# Tuesday, January 16, 2024

## Tasks
- [x] Morning standup
- [x] Code review for PR #142
- [ ] Write API documentation
- [ ] Research caching solutions

## Notes
Interesting discussion about [[Caching Strategies]] in standup. Need to look into Redis vs Memcached.

## Reading
- Started reading "Designing Data-Intensive Applications"
- Good chapter on [[Distributed Systems]] fundamentals

#daily #engineering
EOF

cat > "$VAULT/Daily/2024-01-17.md" << 'EOF'
# Wednesday, January 17, 2024

## Tasks
- [ ] Finish API docs
- [ ] Team retrospective at 2pm
- [ ] 1:1 with manager

## Ideas
- Could we use [[AI Tools]] to automate documentation?
- Look into Obsidian plugins for task management

#daily
EOF

# Project notes
cat > "$VAULT/Projects/Website Redesign/Overview.md" << 'EOF'
---
status: active
priority: high
due: 2024-03-15
tags: [project, web, design]
---

# Website Redesign Project

## Overview
Complete redesign of company website with focus on:
- Modern, responsive design
- Improved performance (target: <2s load time)
- Better SEO structure
- Accessibility compliance (WCAG 2.1 AA)

## Team
- **Lead**: Sarah Chen
- **Design**: Mike Johnson
- **Frontend**: TBD (contractor)
- **Backend**: Current team

## Timeline
| Phase | Dates | Status |
|-------|-------|--------|
| Discovery | Jan 15-31 | In Progress |
| Design | Feb 1-15 | Not Started |
| Development | Feb 15 - Mar 10 | Not Started |
| Testing | Mar 10-15 | Not Started |

## Budget
- Design: $15,000
- Development: $30,000
- Hosting: $500/month

## Related
- [[Meeting Notes - Website Kickoff]]
- [[Brand Guidelines]]
- [[Competitor Analysis]]
EOF

cat > "$VAULT/Projects/Website Redesign/Tech Stack.md" << 'EOF'
# Tech Stack Decisions

## Frontend
- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Components**: Radix UI primitives

## Backend
- Keep existing API
- Add GraphQL layer for new features

## Infrastructure
- **Hosting**: Vercel
- **CDN**: Cloudflare
- **Database**: PostgreSQL (existing)

## Rationale
Chose Next.js for:
- Server-side rendering for SEO
- Great developer experience
- Easy deployment to Vercel

See also: [[Performance Requirements]]
EOF

cat > "$VAULT/Projects/Q1 Planning/Goals.md" << 'EOF'
---
type: planning
quarter: Q1-2024
---

# Q1 2024 Goals

## Engineering
1. Launch website redesign
2. Reduce API latency by 30%
3. Implement automated testing pipeline

## Product
1. Ship 3 major features
2. Reduce churn by 10%
3. Improve NPS score

## Personal
- [ ] Complete AWS certification
- [ ] Give 2 tech talks
- [ ] Mentor junior developer

## Key Results
- Website launch by March 15
- 95% test coverage on critical paths
- Zero P0 incidents

#planning #goals #q1
EOF

# Meeting notes
cat > "$VAULT/Meetings/Meeting Notes - Website Kickoff.md" << 'EOF'
---
date: 2024-01-15
attendees: [Sarah, Mike, Alex, Jordan]
type: kickoff
---

# Website Redesign Kickoff Meeting

**Date**: January 15, 2024
**Attendees**: Sarah, Mike, Alex, Jordan

## Agenda
1. Project overview
2. Timeline review
3. Resource allocation
4. Q&A

## Discussion Notes

### Design Direction
- Mike presented 3 mockup concepts
- Team preferred Option B (modern, clean)
- Need to validate with user testing

### Technical Considerations
- Alex raised concerns about migration path
- Decided to run old and new sites in parallel
- Jordan will handle DNS cutover

## Action Items
- [ ] Mike: Finalize mockups by Jan 22 @mike
- [ ] Sarah: Get stakeholder approval @sarah
- [ ] Alex: Set up staging environment @alex
- [ ] Jordan: Document current infrastructure @jordan

## Next Meeting
January 22, 2024 at 10am

[[Website Redesign]] | [[Q1 Planning]]
EOF

cat > "$VAULT/Meetings/Weekly Standup 2024-01-15.md" << 'EOF'
# Weekly Standup - January 15

## Updates

### Alex
- Completed database migration
- Working on API performance
- Blocked: Need access to production logs

### Sarah
- Website kickoff meeting done
- Contractor interviews this week
- On track for Q1 goals

### Jordan
- Fixed critical bug in auth flow
- Started documentation sprint
- PTO next Friday

## Blockers
- Production log access for Alex
- Design review delayed

## Announcements
- New coffee machine in break room!
- Company all-hands Thursday 3pm
EOF

# Reference notes
cat > "$VAULT/Reference/Caching Strategies.md" << 'EOF'
# Caching Strategies

## Types of Caching

### Client-Side
- Browser cache
- Service workers
- LocalStorage/IndexedDB

### Server-Side
- In-memory (Redis, Memcached)
- Database query cache
- Full-page cache

### CDN
- Edge caching
- Geographic distribution

## Cache Invalidation
> "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

### Strategies
1. **TTL (Time To Live)**: Simple but may serve stale data
2. **Event-based**: Invalidate on write
3. **Versioning**: Include version in cache key

## Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| Data structures | Rich | Simple |
| Persistence | Yes | No |
| Clustering | Yes | Limited |
| Memory efficiency | Lower | Higher |

## Resources
- [Redis Documentation](https://redis.io/docs)
- [[Distributed Systems]]
- [[Performance Requirements]]

#engineering #architecture #caching
EOF

cat > "$VAULT/Reference/Brand Guidelines.md" << 'EOF'
# Brand Guidelines

## Colors

### Primary
- **Blue**: #2563EB (buttons, links)
- **White**: #FFFFFF (backgrounds)
- **Gray**: #1F2937 (text)

### Secondary
- **Green**: #10B981 (success)
- **Red**: #EF4444 (error)
- **Yellow**: #F59E0B (warning)

## Typography
- **Headings**: Inter, bold
- **Body**: Inter, regular
- **Code**: JetBrains Mono

## Logo Usage
- Minimum size: 32px height
- Clear space: 1x logo height
- Don't stretch or distort

## Voice & Tone
- Professional but friendly
- Clear and concise
- Avoid jargon

#brand #design #guidelines
EOF

cat > "$VAULT/Reference/Distributed Systems.md" << 'EOF'
# Distributed Systems Notes

## CAP Theorem
You can only have 2 of 3:
- **Consistency**: All nodes see same data
- **Availability**: Every request gets response
- **Partition Tolerance**: System works despite network failures

## Consensus Algorithms
- Paxos
- Raft (easier to understand)
- ZAB (Zookeeper)

## Common Patterns
1. **Leader Election**
2. **Sharding**
3. **Replication**
4. **Circuit Breaker**

## Books
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "Distributed Systems" by Tanenbaum

Related: [[Caching Strategies]]

#engineering #distributed-systems #architecture
EOF

# Templates
cat > "$VAULT/Templates/Daily Note.md" << 'EOF'
# <date>

## Tasks
- [ ]

## Notes


## Links


#daily
EOF

cat > "$VAULT/Templates/Meeting Note.md" << 'EOF'
---
date: <date>
attendees: []
type: meeting
---

# Meeting: <title>

**Date**: <date>
**Attendees**:

## Agenda
1.

## Discussion Notes


## Action Items
- [ ]

## Next Steps

EOF

cat > "$VAULT/Templates/Project.md" << 'EOF'
---
status: planning
priority: medium
due:
tags: [project]
---

# <title>

## Overview


## Goals
1.

## Timeline


## Resources


## Related

EOF

# Archive
cat > "$VAULT/Archive/Old Project Notes.md" << 'EOF'
# Old Project - Completed

This project was completed in Q4 2023.

## Summary
Successfully launched the mobile app with:
- 10,000 downloads in first week
- 4.5 star rating
- Featured in App Store

## Lessons Learned
- Start user testing earlier
- Budget more time for App Store review
- Cross-platform (React Native) was good choice

#archive #project #mobile
EOF

# Root level notes
cat > "$VAULT/README.md" << 'EOF'
# My Knowledge Base

Welcome to my Obsidian vault!

## Structure
- **Daily/**: Daily notes and journals
- **Projects/**: Active project documentation
- **Meetings/**: Meeting notes and action items
- **Reference/**: Technical references and guides
- **Templates/**: Note templates
- **Archive/**: Completed/old projects

## Quick Links
- [[Q1 Planning]]
- [[Website Redesign]]
- [[Daily/2024-01-17|Today's Note]]

## Tags
- #daily - Daily notes
- #project - Project documentation
- #engineering - Technical content
- #planning - Goals and planning
EOF

cat > "$VAULT/Ideas.md" << 'EOF'
# Ideas & Inbox

Quick capture for ideas to process later.

## Product Ideas
- AI-powered search for documentation
- Integration with Slack for notifications
- Mobile app improvements

## Blog Post Ideas
- How we reduced API latency by 50%
- Lessons from our website redesign
- Building a culture of documentation

## Tools to Try
- [ ] Raycast for productivity
- [ ] Linear for issue tracking
- [ ] Figma Dev Mode

## Random Thoughts
- Could we automate our release notes?
- What if we had a internal podcast?

#inbox #ideas
EOF

echo "✓ Test vault seeded with sample notes"
echo ""
echo "Created:"
echo "  - 3 daily notes"
echo "  - 4 project notes"
echo "  - 2 meeting notes"
echo "  - 3 reference notes"
echo "  - 3 templates"
echo "  - 2 root notes"
echo "  - 1 archived note"
echo ""
echo "Folders: Daily, Projects, Meetings, Reference, Archive, Templates"
