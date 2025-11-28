# EPHOR RELAY Design Guidelines

## Design Approach
**Reference-Based**: Inspired by LMArena's clean, minimal interface with generous whitespace and centered content. Focus on clarity, readability, and distraction-free chat experience.

## Core Design Principles
- **Minimalism First**: Clean, uncluttered interface with generous whitespace
- **Centered Content**: Main chat area centered for optimal reading and focus
- **Functional Clarity**: Every element serves a clear purpose without decoration

## Layout System

### Spacing Primitives
Use Tailwind units: **2, 4, 6, 8, 12, 16** for consistent rhythm
- Tight spacing: p-2, p-4 (buttons, inputs)
- Standard spacing: p-6, p-8 (sections, cards)
- Generous spacing: p-12, p-16 (main containers)

### Structure
**Left Sidebar (Fixed 200px)**
- Full height, fixed position
- White background
- Subtle border-right for separation
- Padding: p-6
- Contains: "EPHOR" branding (top), "+ New Chat" button, chat history list

**Main Content Area**
- Left margin: ml-[200px] to account for sidebar
- Max-width: max-w-3xl for optimal reading
- Centered: mx-auto
- Vertical padding: py-8

**Chat Input (Bottom)**
- Fixed to bottom of main area
- Max-width: max-w-3xl matching content
- Centered with sidebar offset
- Padding: p-4

## Typography

**Font Stack**: Default sans-serif (system fonts)
```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

**Hierarchy**:
- App Title "EPHOR": text-xl font-semibold
- Main Heading "Welcome to EPHOR ARBITRAGE": text-3xl font-medium, mb-2
- Subtitle: text-base text-gray-500
- Chat Messages: text-base leading-relaxed
- Button Text: text-sm font-medium
- Sidebar Items: text-sm

## Component Library

### Navigation (Sidebar)
- Title: Bold, larger text at top
- "+ New Chat" button: Full-width, subtle gray background (bg-gray-100), rounded corners (rounded-lg), padding p-3
- Chat history items: Text links, py-2, hover:bg-gray-50, truncated text

### Controls
- "All Models" dropdown: Top-right corner of main area, minimal border, rounded, px-4 py-2
- Text input: Full-width, border (border-gray-200), rounded-lg, px-4 py-3, placeholder text-gray-400
- "Send" button: Gray (bg-gray-600 text-white), rounded-lg, px-6 py-3, ml-2

### Chat Messages
- User messages: Right-aligned, bg-gray-100, rounded-lg, p-4, max-w-[80%], ml-auto
- AI responses: Left-aligned, bg-white border border-gray-200, rounded-lg, p-4, max-w-[80%]
- Spacing between messages: space-y-4
- Include model name label for AI responses (text-xs text-gray-500)

### Empty State
- Centered vertically and horizontally
- "Welcome to EPHOR ARBITRAGE" heading
- Speed Arbitrage focus subtitle below in gray
- Model selector positioned in top-right corner of container

## Visual Treatment
- **Background**: Pure white (bg-white)
- **Borders**: Light gray (border-gray-200), 1px
- **Text Colors**: Black primary, gray-500 for secondary, gray-400 for placeholders
- **Interactive States**: Subtle hover:bg-gray-50 for clickable items
- **Focus States**: focus:outline-none focus:ring-2 focus:ring-gray-200 for inputs

## Animations
**Minimal to None**: Keep interface snappy and distraction-free
- No scroll animations
- No elaborate transitions
- Simple fade-in for new messages if needed

## Images
**None required**: This is a utility-focused chat interface without hero images or decorative graphics. Focus on typography, whitespace, and functional clarity.