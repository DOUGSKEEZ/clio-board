// Input validation middleware to prevent database bloat attacks
const validation = {
    // Validation limits (protective but practical)
    LIMITS: {
        TASK_TITLE: 100,        // Plenty for a task title
        TASK_NOTES: 20000,      // ~4 pages - same as notes for conversion!
        NOTE_TITLE: 100,        // Same as task title
        NOTE_CONTENT: 20000,    // ~4 pages - for instruction manuals!
        LIST_ITEM_TEXT: 100,    // Plenty for a single item
        ROUTINE_TITLE: 45,      // Plenty for routine names
        ROUTINE_DESCRIPTION: 100, // Brief description
        ROUTINE_ICON: 10,       // Single emoji or short text
    },

    // Validate task creation/update
    validateTask: (req, res, next) => {
        const { title, notes } = req.body;

        if (title && title.length > validation.LIMITS.TASK_TITLE) {
            return res.status(400).json({
                error: "Title too long",
                message: `Task title exceeds ${validation.LIMITS.TASK_TITLE} character limit (provided: ${title.length} chars).`,
                provided: title.length,
                limit: validation.LIMITS.TASK_TITLE
            });
        }

        if (notes && notes.length > validation.LIMITS.TASK_NOTES) {
            return res.status(400).json({
                error: "Description too long", 
                message: `Task notes exceed ${validation.LIMITS.TASK_NOTES} character limit (provided: ${notes.length} chars).`,
                provided: notes.length,
                limit: validation.LIMITS.TASK_NOTES
            });
        }

        next();
    },

    // Validate note creation/update
    validateNote: (req, res, next) => {
        const { title, content } = req.body;

        if (title && title.length > validation.LIMITS.NOTE_TITLE) {
            return res.status(400).json({
                error: "Title too long",
                message: `Note title exceeds ${validation.LIMITS.NOTE_TITLE} character limit (provided: ${title.length} chars).`,
                provided: title.length,
                limit: validation.LIMITS.NOTE_TITLE
            });
        }

        if (content && content.length > validation.LIMITS.NOTE_CONTENT) {
            return res.status(400).json({
                error: "Content exceeds limit",
                message: `Note content exceeds ${validation.LIMITS.NOTE_CONTENT} character limit (provided: ${content.length} chars).`,
                provided: content.length,
                limit: validation.LIMITS.NOTE_CONTENT
            });
        }

        next();
    },

    // Validate list item creation/update
    validateListItem: (req, res, next) => {
        const { text, title } = req.body;
        const itemText = text || title; // Some endpoints use 'text', others use 'title'

        if (itemText && itemText.length > validation.LIMITS.LIST_ITEM_TEXT) {
            return res.status(400).json({
                error: "List item content too long",
                message: `List item exceeds ${validation.LIMITS.LIST_ITEM_TEXT} character limit (provided: ${itemText.length} chars).`,
                provided: itemText.length,
                limit: validation.LIMITS.LIST_ITEM_TEXT
            });
        }

        next();
    },

    // Validate routine creation/update
    validateRoutine: (req, res, next) => {
        const { title, name, description, icon } = req.body;
        const routineTitle = title || name; // Some endpoints use 'title', others use 'name'

        if (routineTitle && routineTitle.length > validation.LIMITS.ROUTINE_TITLE) {
            return res.status(400).json({
                error: "Title too long",
                message: `Routine title exceeds ${validation.LIMITS.ROUTINE_TITLE} character limit (provided: ${routineTitle.length} chars).`,
                provided: routineTitle.length,
                limit: validation.LIMITS.ROUTINE_TITLE
            });
        }

        if (description && description.length > validation.LIMITS.ROUTINE_DESCRIPTION) {
            return res.status(400).json({
                error: "Description too long",
                message: `Routine description exceeds ${validation.LIMITS.ROUTINE_DESCRIPTION} character limit (provided: ${description.length} chars).`,
                provided: description.length,
                limit: validation.LIMITS.ROUTINE_DESCRIPTION
            });
        }

        if (icon && icon.length > validation.LIMITS.ROUTINE_ICON) {
            return res.status(400).json({
                error: `Routine icon too long. Maximum ${validation.LIMITS.ROUTINE_ICON} characters allowed.`,
                provided: icon.length,
                limit: validation.LIMITS.ROUTINE_ICON
            });
        }

        next();
    }
};

module.exports = validation;