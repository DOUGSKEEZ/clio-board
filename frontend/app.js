// CLIO Board Frontend Application
// API Integration and Dynamic Task Management

class ClioBoardApp {
    // Constants for magic strings
    static TASK_STATUS = {
        PENDING: 'pending',
        COMPLETED: 'completed',
        ARCHIVED: 'archived'
    };
    
    static CSS_CLASSES = {
        HIDDEN: 'hidden',
        TASK_CARD: 'task-card',
        TASK_MENU: 'task-menu',
        TASK_COMPLETE_BTN: 'task-complete-btn',
        TASK_MENU_BTN: 'task-menu-btn',
        ARCHIVE_TASK_BTN: 'archive-task-btn',
        EXPAND_BTN: 'expand-btn',
        COLLAPSE_BTN: 'collapse-btn',
        ROUTINE_TAG: 'routine-tag',
        LIST_ITEM_CHECKBOX: 'list-item-checkbox',
        HIDDEN_ITEMS: 'hidden-items'
    };
    
    static VIEWS = {
        TASKS: 'tasks',
        ROUTINES: 'routines'
    };
    
    static ERROR_CODES = {
        OFFLINE: 'OFFLINE',
        NETWORK_ERROR: 'NETWORK_ERROR',
        NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
        HTTP_ERROR: 'HTTP_ERROR',
        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
        RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
    };
    
    constructor() {
        console.log('🏗️ ClioBoardApp constructor called');
        this.tasks = [];
        this.routines = [];
        this.archivedTasks = [];
        this.apiUrl = window.location.origin;
        this.sortables = {};
        this.expandedLists = new Set(); // Track which lists are expanded
        this.routineTagsMinimized = localStorage.getItem('routineTagsMinimized') === 'true'; // Global toggle for all routine tags (Trello-style)
        this.currentView = ClioBoardApp.VIEWS.TASKS; // Track current view
        this.currentRoutine = null; // Track current routine for detail view
        this.pendingToggles = new Set(); // Track tasks with pending completion toggles
        this.abortControllers = new Map(); // Track API requests for cancellation
        this.isOnline = navigator.onLine; // Track network connectivity status
        this.connectionLossTime = null; // Track when connection was lost
        
        console.log('🏗️ Constructor complete, calling init()');
        this.init();
    }

    async init() {
        console.log('🎯 CLIO Board initializing...');
        
        // Show loading overlay
        this.showLoading();
        
        try {
            // Load initial data
            console.log('📡 Loading tasks...');
            await this.loadTasks();
            console.log(`📋 Loaded ${this.tasks.length} tasks`);
            
            console.log('📡 Loading routines...');
            await this.loadRoutines();
            console.log(`🏷️ Loaded ${this.routines.length} routines`);
            
            // Render board
            console.log('🎨 Rendering board...');
            this.renderBoard();
            
            // Initialize drag-and-drop
            this.initializeDragAndDrop();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up network connectivity monitoring
            this.setupNetworkMonitoring();
            
            // Set up error boundary system for user feedback
            this.setupErrorBoundary();
            
            console.log('✅ CLIO Board initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize CLIO Board:', error);
            console.error('Stack trace:', error.stack);
            this.showError(`Failed to load board data: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // API Methods
    async apiCall(endpoint, options = {}) {
        const maxRetries = options.maxRetries ?? 3;
        const retryDelay = options.retryDelay ?? 1000; // Base delay in ms
        const retryMultiplier = options.retryMultiplier ?? 2; // Exponential backoff
        
        // Internal retry wrapper - this does the actual network call
        const attemptRequest = async (attempt = 0) => {
            const url = `${this.apiUrl}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                timeout: options.timeout || 10000, // 10 second default timeout
                ...options
            };

            const attemptPrefix = attempt > 0 ? `🔄 API Retry ${attempt}:` : '🌐 API Call:';
            console.log(`${attemptPrefix} ${options.method || 'GET'} ${url}`);
            
            // Check connectivity before making the request
            if (!this.isConnectionAvailable()) {
                const error = new Error('No internet connection');
                error.code = ClioBoardApp.ERROR_CODES.OFFLINE;
                error.userMessage = 'Unable to connect - you are currently offline. Check your internet connection and try again.';
                error.retryable = true;
                error.offline = true;
                throw error;
            }
            
            try {
                // Create timeout promise for network timeout handling
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), config.timeout);
                });
                
                const fetchPromise = fetch(url, config);
                const response = await Promise.race([fetchPromise, timeoutPromise]);
                
                if (!response.ok) {
                    const errorData = await this.parseErrorResponse(response);
                    console.error(`❌ API Error ${response.status}:`, errorData);
                    
                    // Create structured error object
                    const error = new Error(errorData.message || `HTTP ${response.status}`);
                    error.status = response.status;
                    error.code = errorData.error || 'HTTP_ERROR';
                    error.retryable = this.isRetryableError(response.status);
                    error.userMessage = this.getUserFriendlyMessage(response.status, errorData);
                    error.attempt = attempt + 1;
                    
                    throw error;
                }
                
                // Handle empty responses (like DELETE 204)
                if (response.status === 204 || response.headers.get('content-length') === '0') {
                    console.log(`✅ API Response: No content (${response.status})`);
                    return null;
                }
                
                const data = await response.json();
                console.log(`✅ API Response: ${Array.isArray(data) ? data.length + ' items' : 'object'}`);
                return data;
                
            } catch (error) {
                // Handle different types of network errors
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    // Network connection error
                    error.code = ClioBoardApp.ERROR_CODES.NETWORK_ERROR;
                    error.userMessage = 'Unable to connect to server. Please check your internet connection.';
                    error.retryable = true;
                } else if (error.message === 'NETWORK_TIMEOUT') {
                    // Timeout error
                    error.code = ClioBoardApp.ERROR_CODES.NETWORK_TIMEOUT;
                    error.userMessage = 'Request timed out. The server may be experiencing issues.';
                    error.retryable = true;
                } else if (!error.code) {
                    // Unknown error
                    error.code = ClioBoardApp.ERROR_CODES.UNKNOWN_ERROR;
                    error.userMessage = 'An unexpected error occurred. Please try again.';
                    error.retryable = true;
                }
                
                error.attempt = attempt + 1;
                throw error;
            }
        };
        
        // Retry logic - attempt the request with exponential backoff
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await attemptRequest(attempt);
                
                // Success! Reset any connection warnings
                if (attempt > 0) {
                    console.log(`✅ Request succeeded after ${attempt} retries`);
                    window.dispatchEvent(new CustomEvent('requestRetrySuccess', {
                        detail: { 
                            url: `${this.apiUrl}${endpoint}`,
                            method: options.method || 'GET',
                            attempt: attempt + 1,
                            totalRetries: attempt
                        }
                    }));
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                console.error(`🚨 Network Error (attempt ${attempt + 1}/${maxRetries + 1}):`, {
                    url: `${this.apiUrl}${endpoint}`,
                    method: options.method || 'GET',
                    code: error.code,
                    message: error.message,
                    retryable: error.retryable
                });
                
                // Don't retry if error is not retryable or we've hit max retries
                if (!error.retryable || attempt >= maxRetries) {
                    break;
                }
                
                // Calculate delay with exponential backoff + jitter
                const delay = retryDelay * Math.pow(retryMultiplier, attempt);
                const jitter = Math.random() * 200; // 0-200ms jitter
                const totalDelay = delay + jitter;
                
                console.log(`⏳ Retrying in ${Math.round(totalDelay)}ms...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
        
        // All retries failed, emit final error event
        window.dispatchEvent(new CustomEvent('networkError', { 
            detail: { 
                url: `${this.apiUrl}${endpoint}`, 
                method: options.method || 'GET',
                error: {
                    code: lastError.code,
                    message: lastError.message,
                    userMessage: lastError.userMessage,
                    retryable: lastError.retryable,
                    status: lastError.status,
                    totalAttempts: maxRetries + 1,
                    finalAttempt: true
                }
            }
        }));
        
        throw lastError;
    }
    
    // Helper method to parse error responses
    async parseErrorResponse(response) {
        try {
            const text = await response.text();
            return JSON.parse(text);
        } catch {
            return { message: response.statusText || 'Unknown error' };
        }
    }
    
    // Helper method to determine if error is retryable
    isRetryableError(status) {
        // Retryable: 408, 429, 500, 502, 503, 504
        return [408, 429, 500, 502, 503, 504].includes(status);
    }
    
    // Helper method to get user-friendly error messages
    getUserFriendlyMessage(status, errorData) {
        switch (status) {
            case 400: return 'Invalid request. Please check your input.';
            case 401: return 'You are not authorized to perform this action.';
            case 403: return 'Access denied. You don\'t have permission.';
            case 404: return 'The requested item was not found.';
            case 408: return 'Request timed out. Please try again.';
            case 429: return 'Too many requests. Please wait and try again.';
            case 500: return 'Server error. Please try again later.';
            case 502: return 'Server temporarily unavailable. Please try again.';
            case 503: return 'Service unavailable. Please try again later.';
            case 504: return 'Gateway timeout. Please try again.';
            default: return errorData.message || 'An error occurred. Please try again.';
        }
    }

    async loadTasks() {
        console.log('📡 loadTasks() called, making API call...');
        this.tasks = await this.apiCall('/api/tasks');
        console.log('📋 loadTasks() complete, received', this.tasks.length, 'tasks');
    }

    async loadRoutines() {
        this.routines = await this.apiCall('/api/routines');
    }

    async createTask(taskData) {
        console.log('➕ Creating task:', taskData.title);
        const newTask = await this.apiCall('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
        this.tasks.push(newTask);
        return newTask;
    }

    async moveTask(taskId, newColumn, newPosition = null) {
        console.log(`🔄 Moving task ${taskId} to ${newColumn} at position ${newPosition}`);
        const updatedTask = await this.apiCall(`/api/tasks/${taskId}/move`, {
            method: 'PUT',
            body: JSON.stringify({ 
                column: newColumn,
                position: newPosition 
            })
        });
        
        // Update local data
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = updatedTask;
        }
        
        return updatedTask;
    }

    async toggleItemComplete(taskId, itemId, completed) {
        console.log(`✓ Toggling item ${itemId} completion to ${completed}`);
        return await this.apiCall(`/api/tasks/${taskId}/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ completed })
        });
    }

    // Rendering Methods
    renderBoard() {
        console.log('🎨 Rendering board...');
        
        const columns = ['today', 'tomorrow', 'this_week', 'horizon'];
        
        columns.forEach(column => {
            this.renderColumn(column);
        });
        
        this.updateTaskCounts();
        this.updateColumnDateIndicators();
    }

    renderColumn(column) {
        const columnTasks = this.tasks.filter(task => task.column_name === column);
        const container = document.getElementById(`${this.getColumnId(column)}-tasks`);
        
        if (!container) {
            console.error(`Container not found for column: ${column}`);
            return;
        }
        
        container.innerHTML = '';
        
        columnTasks.forEach(task => {
            const taskElement = this.createTaskCard(task);
            container.appendChild(taskElement);
        });
        
        // Add ghost "Add Task" card at the bottom (inside the container for proper spacing)
        const addCard = document.createElement('div');
        addCard.className = 'add-task-ghost-card group bg-transparent border-2 border-dashed border-gray-300 border-opacity-50 rounded-lg p-2 hover:border-opacity-100 hover:border-blue-400 hover:bg-blue-50 hover:bg-opacity-60 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 min-h-[40px]';
        addCard.innerHTML = `
            <i class="fas fa-plus text-sm transition-transform duration-200 group-hover:scale-150"></i>
        `;
        
        // Add click handler to open add task modal with this column pre-selected
        addCard.addEventListener('click', () => {
            this.openAddTaskModal(column);
        });
        
        container.appendChild(addCard);
    }

    createTaskCard(task) {
        const div = document.createElement('div');
        const routineInfo = task.routine_id ? 
            this.routines.find(r => r.id === task.routine_id) : null;
        const isPaused = routineInfo && routineInfo.status === 'paused';
        
        div.className = `task-card ${isPaused ? 'bg-gray-200 opacity-90' : 'bg-white'} rounded-lg p-1.5 shadow-sm card-transition cursor-pointer border border-gray-200 hover:border-blue-400 hover:border-2 hover:shadow-md group`;
        div.setAttribute('data-task-id', task.id);
        div.setAttribute('data-task-type', task.type);
        
        const dueDate = task.due_date ? 
            new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
        
        const hasListItems = task.type === 'list' && task.items && task.items.length > 0;
        const minimizedRoutineTag = this.renderMinimizedRoutineTag(routineInfo);
        const fullRoutineTag = this.renderFullRoutineTag(routineInfo);
        const hasBottomContent = fullRoutineTag || dueDate;
        
        div.innerHTML = `
            <div class="flex items-start justify-between ${hasListItems || hasBottomContent ? 'mb-1' : ''}">
                <div class="flex items-center flex-1 min-w-0 relative">
                    <button class="task-complete-btn absolute left-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 hover:border-green-500 hover:shadow-sm ${task.status === ClioBoardApp.TASK_STATUS.COMPLETED ? 'opacity-100 bg-green-500 border-green-500' : 'opacity-0 group-hover:opacity-100 border-gray-300'}" data-task-id="${task.id}">
                        ${task.status === ClioBoardApp.TASK_STATUS.COMPLETED ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
                    </button>
                    <h3 class="text-sm font-medium min-w-0 flex-1 transition-all duration-200 truncate ${task.status === ClioBoardApp.TASK_STATUS.COMPLETED ? 'text-gray-500 line-through ml-6' : isPaused ? 'text-gray-500 group-hover:ml-6' : 'text-gray-900 group-hover:ml-6'}">${this.escapeHtml(task.title)}</h3>
                </div>
                ${minimizedRoutineTag ? `
                    <div class="flex items-center ml-1 mr-1">
                        ${minimizedRoutineTag}
                    </div>
                ` : ''}
                <div class="flex items-center space-x-1">
                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all relative">
                        <button class="task-menu-btn text-gray-400 hover:text-gray-600 transition-all p-1 -m-1 rounded" data-task-id="${task.id}">
                            <i class="fas fa-ellipsis-h text-sm"></i>
                        </button>
                        <div class="task-menu absolute -left-10 bottom-3 mb-1 bg-white border border-gray-200 rounded-md shadow-lg z-[200] min-w-[80px] hidden">
                            <button class="archive-task-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2" data-task-id="${task.id}">
                                <i class="fas fa-archive text-xs"></i>
                                <span>Archive</span>
                            </button>
                        </div>
                    </div>
                    ${isPaused ? '<span class="text-gray-500 text-xs ml-1">▐▐</span>' : ''}
                </div>
            </div>
            
            ${hasListItems ? this.renderListItems(task.items, task, isPaused) : ''}
            
            ${hasBottomContent ? `
                <div class="flex items-center justify-between ${hasListItems ? 'mt-1' : 'mt-0.5'}">
                    ${fullRoutineTag}
                    <div class="flex items-center space-x-2 text-xs text-gray-500">
                        ${dueDate ? `<span><i class="fas fa-calendar mr-1"></i>${dueDate}</span>` : ''}
                    </div>
                </div>
            ` : ''}
        `;
        
        // Initialize expand/collapse state (event delegation handles clicks)
        const expandBtn = div.querySelector('.expand-btn');
        const collapseBtn = div.querySelector('.collapse-btn');
        const hiddenItems = div.querySelector('.hidden-items');

        if (expandBtn && collapseBtn && hiddenItems) {
            // Check if this list should be expanded on render
            const isExpanded = this.expandedLists.has(task.id);
            if (isExpanded) {
                hiddenItems.classList.remove(ClioBoardApp.CSS_CLASSES.HIDDEN);
                expandBtn.classList.add(ClioBoardApp.CSS_CLASSES.HIDDEN);
                collapseBtn.classList.remove(ClioBoardApp.CSS_CLASSES.HIDDEN);
            }
        }
        
        return div;
    }

    renderListItems(items, task, isPaused = false) {
        if (!items || items.length === 0) return '';
        
        // Sort items by position, falling back to id for stable ordering
        const sortedItems = [...items].sort((a, b) => {
            const positionA = a.position !== undefined ? a.position : 999999;
            const positionB = b.position !== undefined ? b.position : 999999;
            if (positionA === positionB) {
                return a.id - b.id; // Fallback to id for stable ordering
            }
            return positionA - positionB;
        });
        
        const visibleItems = sortedItems.slice(0, 4);
        const hiddenItems = sortedItems.slice(4);
        const hasMore = hiddenItems.length > 0;
        
        const visibleItemsHtml = visibleItems.map(item => `
            <div class="flex items-center space-x-2 text-xs">
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="w-3 h-3 text-green-600 list-item-checkbox flex-shrink-0 ${isPaused ? 'opacity-40' : ''}" 
                       ${isPaused ? 'style="accent-color: #d1d5db; background-color: #d1d5db !important; -webkit-appearance: none; appearance: none; border: 1px solid #9ca3af; border-radius: 3px;"' : ''}
                       data-task-id="${task.id}"
                       data-item-id="${item.id}">
                <span class="truncate ${item.completed ? 'line-through text-gray-500' : isPaused ? 'text-gray-500' : 'text-gray-700'}" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</span>
            </div>
        `).join('');
        
        const hiddenItemsHtml = hiddenItems.map(item => `
            <div class="flex items-center space-x-2 text-xs">
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="w-3 h-3 text-green-600 list-item-checkbox flex-shrink-0 ${isPaused ? 'opacity-40' : ''}" 
                       ${isPaused ? 'style="accent-color: #d1d5db; background-color: #d1d5db !important; -webkit-appearance: none; appearance: none; border: 1px solid #9ca3af; border-radius: 3px;"' : ''}
                       data-task-id="${task.id}"
                       data-item-id="${item.id}">
                <span class="truncate ${item.completed ? 'line-through text-gray-500' : isPaused ? 'text-gray-500' : 'text-gray-700'}" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</span>
            </div>
        `).join('');
        
        const expandButton = hasMore ? `
            <button type="button" 
                    class="text-xs text-blue-600 hover:text-blue-700 expand-btn" 
                    data-task-id="${task.id}">
                <i class="fas fa-chevron-down mr-1"></i>Show ${hiddenItems.length} more
            </button>
        ` : '';
        
        const collapseButton = hasMore ? `
            <button type="button" 
                    class="text-xs text-blue-600 hover:text-blue-700 collapse-btn hidden" 
                    data-task-id="${task.id}">
                <i class="fas fa-chevron-up mr-1"></i>Show less
            </button>
        ` : '';
        
        const listStatus = this.renderListStatus(items);
        
        return `
            <div class="list-items space-y-1 mb-1 p-1.5 ${isPaused ? 'bg-gray-100 opacity-75' : 'bg-gray-50'} rounded" data-list-container="${task.id}">
                <div class="visible-items">
                    ${visibleItemsHtml}
                </div>
                <div class="hidden-items hidden">
                    ${hiddenItemsHtml}
                </div>
                <div class="flex items-center justify-between mt-0.5">
                    <div>
                        ${expandButton}
                        ${collapseButton}
                    </div>
                    <div class="text-xs text-gray-500">
                        ${listStatus}
                    </div>
                </div>
            </div>
        `;
    }

    renderListStatus(items) {
        if (!items || items.length === 0) return '';
        
        const completed = items.filter(item => item.completed).length;
        const total = items.length;
        
        return `<span><i class="fas fa-list mr-1"></i>${completed}/${total}</span>`;
    }

    renderRoutineTag(routine) {
        if (!routine) {
            return ''; // Don't show anything for tasks without routines
        }
        
        const isPaused = routine.status === 'paused';
        const isMinimized = this.routineTagsMinimized;
        
        // Color mapping for both full and minimized states
        const colorClassMap = {
            blue: { full: 'bg-blue-100 text-blue-700', minimal: 'bg-blue-500' },
            green: { full: 'bg-green-200 text-green-800', minimal: 'bg-green-500' },
            purple: { full: 'bg-purple-100 text-purple-700', minimal: 'bg-purple-500' },
            orange: { full: 'bg-orange-100 text-orange-700', minimal: 'bg-orange-500' },
            red: { full: 'bg-red-100 text-red-700', minimal: 'bg-red-500' },
            yellow: { full: 'bg-yellow-100 text-yellow-700', minimal: 'bg-yellow-500' },
            pink: { full: 'bg-pink-100 text-pink-700', minimal: 'bg-pink-500' },
            gray: { full: 'bg-gray-100 text-gray-700', minimal: 'bg-gray-500' },
            brown: { full: 'bg-amber-400 text-amber-900', minimal: 'bg-amber-700' },
            teal: { full: 'bg-teal-100 text-teal-700', minimal: 'bg-teal-500' },
            lime: { full: 'bg-lime-50 text-lime-700', minimal: 'bg-lime-500' },
            black: { full: 'bg-gray-600 text-white', minimal: 'bg-gray-800' }
        };
        
        if (isPaused) {
            if (isMinimized) {
                return `
                    <span class="routine-tag-minimized bg-gray-400 cursor-pointer transition-all duration-200 hover:scale-110" 
                          data-routine-id="${routine.id}" 
                          title="${routine.icon} ${this.escapeHtml(routine.title)} (Paused)">
                    </span>
                `;
            } else {
                return `
                    <span class="routine-tag text-gray-600 bg-gray-100 opacity-80 cursor-pointer" 
                          data-routine-id="${routine.id}">
                        ${routine.icon} ${this.escapeHtml(routine.title)}
                    </span>
                `;
            }
        }
        
        // Handle custom brown color with inline styles
        if (routine.color === 'brown') {
            if (isMinimized) {
                return `
                    <span class="routine-tag-minimized cursor-pointer transition-all duration-200 hover:scale-110" 
                          style="background-color: #92633f;" 
                          data-routine-id="${routine.id}"
                          title="${routine.icon} ${this.escapeHtml(routine.title)}">
                    </span>
                `;
            } else {
                return `
                    <span class="routine-tag cursor-pointer" 
                          style="background-color: #e8d8cf; color: #73513b;" 
                          data-routine-id="${routine.id}">
                        ${routine.icon} ${this.escapeHtml(routine.title)}
                    </span>
                `;
            }
        }
        
        // Get the color classes for this routine
        const colorConfig = colorClassMap[routine.color] || colorClassMap.blue;
        
        if (isMinimized) {
            return `
                <span class="routine-tag-minimized ${colorConfig.minimal} cursor-pointer transition-all duration-200 hover:scale-110" 
                      data-routine-id="${routine.id}"
                      title="${routine.icon} ${this.escapeHtml(routine.title)}">
                </span>
            `;
        } else {
            return `
                <span class="routine-tag ${colorConfig.full} cursor-pointer" 
                      data-routine-id="${routine.id}">
                    ${routine.icon} ${this.escapeHtml(routine.title)}
                </span>
            `;
        }
    }

    // Helper methods for different routine tag placements
    renderMinimizedRoutineTag(routine) {
        if (!routine || !this.routineTagsMinimized) return '';
        
        const isPaused = routine.status === 'paused';
        
        if (isPaused) {
            return `
                <span class="routine-tag-minimized bg-gray-400 cursor-pointer transition-all duration-200 hover:scale-110" 
                      data-routine-id="${routine.id}" 
                      title="${routine.icon} ${this.escapeHtml(routine.title)} (Paused)">
                </span>
            `;
        }

        // Handle custom brown color with inline styles
        if (routine.color === 'brown') {
            return `
                <span class="routine-tag-minimized cursor-pointer transition-all duration-200 hover:scale-110" 
                      style="background-color: #92633f;" 
                      data-routine-id="${routine.id}"
                      title="${routine.icon} ${this.escapeHtml(routine.title)}">
                </span>
            `;
        }
        
        // Color mapping for minimized state - use more visible/darker colors
        const colorClassMap = {
            blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500',
            orange: 'bg-orange-500', red: 'bg-red-500', yellow: 'bg-yellow-500',
            pink: 'bg-pink-500', gray: 'bg-gray-500', brown: 'bg-amber-700',
            teal: 'bg-teal-500', lime: 'bg-lime-500', black: 'bg-gray-800'
        };
        
        const colorClass = colorClassMap[routine.color] || 'bg-blue-500';
        
        return `
            <span class="routine-tag-minimized ${colorClass} cursor-pointer transition-all duration-200 hover:scale-110" 
                  data-routine-id="${routine.id}"
                  title="${routine.icon} ${this.escapeHtml(routine.title)}">
            </span>
        `;
    }

    renderFullRoutineTag(routine) {
        if (!routine || this.routineTagsMinimized) return '';
        
        const isPaused = routine.status === 'paused';
        
        if (isPaused) {
            return `
                <span class="routine-tag text-gray-600 bg-gray-100 opacity-80 cursor-pointer" 
                      data-routine-id="${routine.id}">
                    ${routine.icon} ${this.escapeHtml(routine.title)}
                </span>
            `;
        }

        // Handle custom brown color with inline styles
        if (routine.color === 'brown') {
            return `
                <span class="routine-tag cursor-pointer" 
                      style="background-color: #e8d8cf; color: #73513b;" 
                      data-routine-id="${routine.id}">
                    ${routine.icon} ${this.escapeHtml(routine.title)}
                </span>
            `;
        }
        
        // Color mapping for full state
        const colorClassMap = {
            blue: 'bg-blue-100 text-blue-700', green: 'bg-green-200 text-green-800',
            purple: 'bg-purple-100 text-purple-700', orange: 'bg-orange-100 text-orange-700',
            red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-700',
            pink: 'bg-pink-100 text-pink-700', gray: 'bg-gray-100 text-gray-700',
            brown: 'bg-amber-400 text-amber-900', teal: 'bg-teal-100 text-teal-700',
            lime: 'bg-lime-50 text-lime-700', black: 'bg-gray-600 text-white'
        };
        
        const colorClass = colorClassMap[routine.color] || 'bg-blue-100 text-blue-700';
        
        return `
            <span class="routine-tag ${colorClass} cursor-pointer" 
                  data-routine-id="${routine.id}">
                ${routine.icon} ${this.escapeHtml(routine.title)}
            </span>
        `;
    }

    updateRoutinePickerDisplay(prefix) {
        // Get the currently selected routine ID for this prefix
        const hiddenInput = document.getElementById(`${prefix}-routine`);
        if (!hiddenInput || !hiddenInput.value) return;
        
        const routineId = hiddenInput.value;
        
        // Check if the routine being edited is the currently selected one
        if (this.currentEditingRoutine && this.currentEditingRoutine.id === routineId) {
            // Update just the display span without affecting picker state
            const displaySpan = document.getElementById(`${prefix}-routine-display`);
            if (displaySpan) {
                const routine = this.routines.find(r => r.id === routineId);
                if (routine) {
                    const routineTag = this.renderRoutineTag(routine);
                    displaySpan.innerHTML = routineTag;
                    console.log(`🎨 Updated routine picker display for '${prefix}' with new color`);
                }
            }
        }
    }

    resetRoutinePickerToMain(prefix) {
        // Always ensure we're showing the main picker view and hiding the edit panel
        const mainView = document.getElementById(`${prefix}-routine-main`);
        const editView = document.getElementById(`${prefix}-routine-edit`);
        
        if (mainView && editView) {
            mainView.classList.remove('hidden');
            editView.classList.add('hidden');
        }
        
        // Clear any editing state
        this.currentEditingRoutine = null;
        this.selectedEditColor = null;
        
        console.log(`🔄 Reset routine picker '${prefix}' to main view`);
    }

    triggerTaskCompletionConfetti(button) {
        // Get button position for confetti origin
        const rect = button.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        
        // Small, localized confetti burst
        confetti({
            particleCount: 20,
            spread: 40,
            origin: { x, y },
            colors: ['#10b981', '#059669', '#34d399'], // Green theme
            scalar: 0.8, // Smaller particles
            gravity: 1.2, // Falls a bit faster
            drift: 0, // No wind effect
            ticks: 120 // Shorter duration
        });
    }

    triggerRoutineCompletionCelebration() {
        // BIG CELEBRATION! Multiple waves of confetti
        const celebrationColors = [
            '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
        ];

        // First wave - center burst
        confetti({
            particleCount: 100,
            spread: 120,
            origin: { x: 0.5, y: 0.6 },
            colors: celebrationColors,
            scalar: 1.2,
            gravity: 0.8,
            drift: 0,
            ticks: 200
        });

        // Second wave - left side after 200ms
        setTimeout(() => {
            confetti({
                particleCount: 80,
                spread: 100,
                origin: { x: 0.1, y: 0.7 },
                colors: celebrationColors,
                scalar: 1.0,
                gravity: 0.9,
                drift: 1,
                ticks: 180
            });
        }, 200);

        // Third wave - right side after 400ms
        setTimeout(() => {
            confetti({
                particleCount: 80,
                spread: 100,
                origin: { x: 0.9, y: 0.7 },
                colors: celebrationColors,
                scalar: 1.0,
                gravity: 0.9,
                drift: -1,
                ticks: 180
            });
        }, 400);

        // Final celebration - top center after 600ms
        setTimeout(() => {
            confetti({
                particleCount: 60,
                spread: 80,
                origin: { x: 0.5, y: 0.3 },
                colors: celebrationColors,
                scalar: 0.9,
                gravity: 1.0,
                drift: 0,
                ticks: 150
            });
        }, 600);

        console.log('🎊 BIG ROUTINE COMPLETION CELEBRATION! 🎉');
    }

    // Trello-style routine tag toggle functionality
    toggleRoutineTagsDisplay() {
        this.routineTagsMinimized = !this.routineTagsMinimized;
        localStorage.setItem('routineTagsMinimized', this.routineTagsMinimized.toString());
        console.log(`🏷️ Routine tags ${this.routineTagsMinimized ? 'minimized' : 'expanded'}`);
        
        // Re-render the board to apply the new tag display mode
        this.renderBoard();
        
        // If we're in routines view, re-render that too
        if (this.currentView === 'routines') {
            this.loadRoutinesView();
        }
    }

    getColumnId(column) {
        const mapping = {
            'today': 'today',
            'tomorrow': 'tomorrow',
            'this_week': 'week',
            'horizon': 'horizon'
        };
        return mapping[column] || column;
    }

    updateTaskCounts() {
        const columns = ['today', 'tomorrow', 'this_week', 'horizon'];
        
        columns.forEach(column => {
            const count = this.tasks.filter(task => task.column_name === column).length;
            const countElement = document.getElementById(`${this.getColumnId(column)}-count`);
            if (countElement) {
                countElement.textContent = count;
            }
        });
    }

    updateColumnDateIndicators() {
        const now = new Date();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Update Today column - wrap date and + button together
        const todayColumn = document.querySelector('[data-column="today"]');
        if (todayColumn) {
            const headerDiv = todayColumn.querySelector('.flex.items-center.justify-between');
            const plusButton = headerDiv.querySelector('button');
            const dayName = dayNames[now.getDay()];
            
            // Check if we already have a wrapper
            let rightWrapper = headerDiv.querySelector('.date-plus-wrapper');
            if (!rightWrapper) {
                // Create wrapper for date + button
                rightWrapper = document.createElement('div');
                rightWrapper.className = 'date-plus-wrapper flex items-center';
                
                // Create date span
                const dateSpan = document.createElement('span');
                dateSpan.className = 'date-indicator text-xs text-gray-400 font-semibold mr-2';
                
                // Move plus button into wrapper
                headerDiv.removeChild(plusButton);
                rightWrapper.appendChild(dateSpan);
                rightWrapper.appendChild(plusButton);
                headerDiv.appendChild(rightWrapper);
            }
            
            // Update the date text
            const dateSpan = rightWrapper.querySelector('.date-indicator');
            dateSpan.textContent = dayName;
        }
        
        // Update Tomorrow column
        const tomorrowColumn = document.querySelector('[data-column="tomorrow"]');
        if (tomorrowColumn) {
            const headerDiv = tomorrowColumn.querySelector('.flex.items-center.justify-between');
            const plusButton = headerDiv.querySelector('button');
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayName = dayNames[tomorrow.getDay()];
            
            let rightWrapper = headerDiv.querySelector('.date-plus-wrapper');
            if (!rightWrapper) {
                rightWrapper = document.createElement('div');
                rightWrapper.className = 'date-plus-wrapper flex items-center';
                const dateSpan = document.createElement('span');
                dateSpan.className = 'date-indicator text-xs text-gray-400 font-semibold mr-2';
                headerDiv.removeChild(plusButton);
                rightWrapper.appendChild(dateSpan);
                rightWrapper.appendChild(plusButton);
                headerDiv.appendChild(rightWrapper);
            }
            
            const dateSpan = rightWrapper.querySelector('.date-indicator');
            dateSpan.textContent = dayName;
        }
        
        // Update This Week/Next Week column
        const weekColumn = document.querySelector('[data-column="this_week"]');
        if (weekColumn) {
            const headerDiv = weekColumn.querySelector('.flex.items-center.justify-between');
            const plusButton = headerDiv.querySelector('button');
            const weekHeader = weekColumn.querySelector('h2');
            const dayOfWeek = now.getDay();
            // Weekend: Saturday (6) or Sunday (0) -> "Next Week"
            // End of week: Thursday (4) or Friday (5) -> "This Weekend"  
            // Start of week: Monday (1), Tuesday (2), Wednesday (3) -> "This Week"
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isEndOfWeek = dayOfWeek === 4 || dayOfWeek === 5; // Thursday or Friday
            
            let dateRange;
            if (isWeekend) {
                weekHeader.firstChild.textContent = 'Next Week';
                
                // Calculate next week's date range (Monday to Sunday)
                const nextMonday = new Date(now);
                const daysToMonday = dayOfWeek === 0 ? 1 : 2; // Sunday needs 1 day, Saturday needs 2
                nextMonday.setDate(nextMonday.getDate() + daysToMonday);
                
                const nextSunday = new Date(nextMonday);
                nextSunday.setDate(nextSunday.getDate() + 6);
                
                dateRange = `${nextMonday.getMonth() + 1}/${nextMonday.getDate()}-${nextSunday.getMonth() + 1}/${nextSunday.getDate()}`;
            } else if (isEndOfWeek) {
                weekHeader.firstChild.textContent = 'This Weekend';
                
                // Calculate weekend range (Thursday to Sunday)
                const thursday = new Date(now);
                thursday.setDate(thursday.getDate() - (dayOfWeek - 4)); // Go back to Thursday of this week
                
                const sunday = new Date(thursday);
                sunday.setDate(sunday.getDate() + 3); // Thursday + 3 = Sunday
                
                dateRange = `${thursday.getMonth() + 1}/${thursday.getDate()}-${sunday.getMonth() + 1}/${sunday.getDate()}`;
            } else {
                weekHeader.firstChild.textContent = 'This Week';
                
                // Calculate this week's date range (Monday to Sunday)
                const monday = new Date(now);
                monday.setDate(monday.getDate() - (dayOfWeek - 1)); // Go back to Monday
                
                const sunday = new Date(monday);
                sunday.setDate(sunday.getDate() + 6);
                
                dateRange = `${monday.getMonth() + 1}/${monday.getDate()}-${sunday.getMonth() + 1}/${sunday.getDate()}`;
            }
            
            let rightWrapper = headerDiv.querySelector('.date-plus-wrapper');
            if (!rightWrapper) {
                rightWrapper = document.createElement('div');
                rightWrapper.className = 'date-plus-wrapper flex items-center';
                const dateSpan = document.createElement('span');
                dateSpan.className = 'date-indicator text-xs text-gray-400 font-semibold mr-2';
                headerDiv.removeChild(plusButton);
                rightWrapper.appendChild(dateSpan);
                rightWrapper.appendChild(plusButton);
                headerDiv.appendChild(rightWrapper);
            }
            
            const dateSpan = rightWrapper.querySelector('.date-indicator');
            dateSpan.textContent = dateRange;
        }
        
        // Update Horizon column
        const horizonColumn = document.querySelector('[data-column="horizon"]');
        if (horizonColumn) {
            const headerDiv = horizonColumn.querySelector('.flex.items-center.justify-between');
            const plusButton = headerDiv.querySelector('button');
            
            let rightWrapper = headerDiv.querySelector('.date-plus-wrapper');
            if (!rightWrapper) {
                rightWrapper = document.createElement('div');
                rightWrapper.className = 'date-plus-wrapper flex items-center';
                const dateSpan = document.createElement('span');
                dateSpan.className = 'date-indicator text-xs text-gray-400 font-semibold mr-2';
                headerDiv.removeChild(plusButton);
                rightWrapper.appendChild(dateSpan);
                rightWrapper.appendChild(plusButton);
                headerDiv.appendChild(rightWrapper);
            }
            
            const dateSpan = rightWrapper.querySelector('.date-indicator');
            dateSpan.textContent = 'Future';
        }
    }

    // Event Handlers
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        
        // Add task form
        document.getElementById('add-task-form').addEventListener('submit', (e) => {
            this.handleAddTask(e);
        });
        
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close modals in priority order - close topmost modal first
                const addTaskModal = document.getElementById('add-task-modal');
                const editTaskModal = document.getElementById('edit-task-modal');
                const archiveModal = document.getElementById('archive-modal');
                const routineModal = document.getElementById('routine-modal');
                
                // Check task modals first (they have higher z-index)
                if (addTaskModal && !addTaskModal.classList.contains('hidden')) {
                    this.closeAddTaskModal();
                } else if (editTaskModal && !editTaskModal.classList.contains('hidden')) {
                    this.closeEditTaskModal();
                } else if (archiveModal && !archiveModal.classList.contains('hidden')) {
                    this.closeArchiveModal();
                } else if (routineModal && !routineModal.classList.contains('hidden')) {
                    this.closeRoutineModal();
                }
            }
        });

        // Archive tab button
        const archiveTabBtn = document.getElementById('archive-tab-btn');
        if (archiveTabBtn) {
            archiveTabBtn.addEventListener('click', () => {
                this.openArchiveModal();
            });
        }

        // Close archive modal button
        const closeArchiveModalBtn = document.getElementById('close-archive-modal');
        if (closeArchiveModalBtn) {
            closeArchiveModalBtn.addEventListener('click', () => {
                this.closeArchiveModal();
            });
        }

        // Close modals when clicking outside
        const addTaskModal = document.getElementById('add-task-modal');
        const editTaskModal = document.getElementById('edit-task-modal');
        const archiveModal = document.getElementById('archive-modal');
        const routineModal = document.getElementById('routine-modal');
        
        if (addTaskModal) {
            addTaskModal.addEventListener('click', (e) => {
                if (e.target === addTaskModal) {
                    this.closeAddTaskModal();
                }
            });
        }
        
        if (editTaskModal) {
            editTaskModal.addEventListener('click', (e) => {
                if (e.target === editTaskModal) {
                    this.closeEditTaskModal();
                }
            });
        }
        
        if (archiveModal) {
            archiveModal.addEventListener('click', (e) => {
                if (e.target === archiveModal) {
                    this.closeArchiveModal();
                }
            });
        }
        
        if (routineModal) {
            routineModal.addEventListener('click', (e) => {
                if (e.target === routineModal) {
                    this.closeRoutineModal();
                }
            });
        }

        // Column add task buttons - only target buttons, not column containers
        document.querySelectorAll('button[data-column]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                const column = button.dataset.column;
                this.addTaskToColumn(column);
            });
        });

        // Modal close buttons
        const closeModalX = document.getElementById('close-modal-x');
        if (closeModalX) {
            closeModalX.addEventListener('click', () => {
                this.closeAddTaskModal();
            });
        }

        const cancelTaskBtn = document.getElementById('cancel-task-btn');
        if (cancelTaskBtn) {
            cancelTaskBtn.addEventListener('click', () => {
                this.closeAddTaskModal();
            });
        }

        // Add list item button
        const addListItemBtn = document.getElementById('add-list-item-btn');
        if (addListItemBtn) {
            addListItemBtn.addEventListener('click', () => {
                this.addListItemField();
            });
        }

        // Custom date button
        const dueDateBtn = document.getElementById('due-date-btn');
        const dueDateInput = document.getElementById('task-due-date');
        const dueDateDisplay = document.getElementById('due-date-display');
        
        if (dueDateBtn && dueDateInput) {
            dueDateBtn.addEventListener('click', () => {
                // Temporarily position the input over the button
                dueDateInput.style.pointerEvents = 'auto';
                dueDateInput.style.opacity = '1';
                dueDateInput.style.position = 'absolute';
                dueDateInput.style.left = '0';
                dueDateInput.style.top = '0';
                dueDateInput.style.width = dueDateBtn.offsetWidth + 'px';
                dueDateInput.style.height = dueDateBtn.offsetHeight + 'px';
                
                // Focus and show picker
                dueDateInput.focus();
                dueDateInput.showPicker();
                
                // Hide the input again after a short delay
                setTimeout(() => {
                    dueDateInput.style.pointerEvents = 'none';
                    dueDateInput.style.opacity = '0';
                }, 100);
            });
            
            dueDateInput.addEventListener('change', () => {
                if (dueDateInput.value) {
                    // Parse the date as local date to avoid timezone issues
                    const [year, month, day] = dueDateInput.value.split('-');
                    const date = new Date(year, month - 1, day); // month is 0-indexed
                    const formatted = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    dueDateDisplay.textContent = formatted;
                } else {
                    dueDateDisplay.textContent = 'Set date';
                }
            });
        }

        // Edit modal event listeners
        const editTaskForm = document.getElementById('edit-task-form');
        if (editTaskForm) {
            editTaskForm.addEventListener('submit', (e) => {
                this.handleEditTask(e);
            });
        }

        const closeEditModalX = document.getElementById('close-edit-modal-x');
        if (closeEditModalX) {
            closeEditModalX.addEventListener('click', () => {
                this.closeEditTaskModal();
            });
        }

        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.closeEditTaskModal();
            });
        }

        const editAddListItemBtn = document.getElementById('edit-add-list-item-btn');
        if (editAddListItemBtn) {
            editAddListItemBtn.addEventListener('click', () => {
                this.addEditListItemField();
            });
        }

        // Edit modal completion button
        const editCompleteBtn = document.getElementById('edit-task-complete-btn');
        const editCompleteLabel = document.getElementById('edit-complete-label');
        
        if (editCompleteBtn) {
            editCompleteBtn.addEventListener('click', () => {
                // Double-click protection for modal too
                if (this.pendingToggles.has(this.editingTask.id)) {
                    console.log(`⏳ Ignoring modal click - already pending`);
                    return;
                }
                
                const newStatus = this.editingTask.status === 'completed' ? 'pending' : 'completed';
                const oldStatus = this.editingTask.status;
                
                // Optimistic UI update
                this.editingTask.status = newStatus;
                this.updateEditModalCompletionUI(newStatus);
                
                // Trigger confetti animation if completing the task
                if (newStatus === 'completed') {
                    this.triggerTaskCompletionConfetti(editCompleteBtn);
                }
                
                // Use optimistic handler (will also update task cards in background)
                this.handleTaskToggleOptimisticModal(this.editingTask.id, newStatus, oldStatus);
            });
            
            // Make label clickable too
            if (editCompleteLabel) {
                editCompleteLabel.addEventListener('click', () => {
                    editCompleteBtn.click();
                });
            }
        }
        
        // Edit modal date picker
        const editDueDateBtn = document.getElementById('edit-due-date-btn');
        const editDueDateInput = document.getElementById('edit-task-due-date');
        const editDueDateDisplay = document.getElementById('edit-due-date-display');
        
        if (editDueDateBtn && editDueDateInput) {
            editDueDateBtn.addEventListener('click', () => {
                editDueDateInput.style.pointerEvents = 'auto';
                editDueDateInput.style.opacity = '1';
                editDueDateInput.style.position = 'absolute';
                editDueDateInput.style.left = '0';
                editDueDateInput.style.top = '0';
                editDueDateInput.style.width = editDueDateBtn.offsetWidth + 'px';
                editDueDateInput.style.height = editDueDateBtn.offsetHeight + 'px';
                
                editDueDateInput.focus();
                editDueDateInput.showPicker();
                
                setTimeout(() => {
                    editDueDateInput.style.pointerEvents = 'none';
                    editDueDateInput.style.opacity = '0';
                }, 100);
            });
            
            editDueDateInput.addEventListener('change', () => {
                if (editDueDateInput.value) {
                    const [year, month, day] = editDueDateInput.value.split('-');
                    const date = new Date(year, month - 1, day);
                    const formatted = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    editDueDateDisplay.textContent = formatted;
                } else {
                    editDueDateDisplay.textContent = 'Set date';
                }
            });
        }

        // Global click listener to close menus when clicking outside
        document.addEventListener('click', (e) => {
            // Check if the click is outside any task menu or menu button
            const taskMenu = e.target.closest('.task-menu');
            const taskMenuButton = e.target.closest('.task-menu-btn');
            
            if (!taskMenu && !taskMenuButton) {
                // Close all open task menus
                document.querySelectorAll('.task-menu').forEach(menu => {
                    menu.classList.add('hidden');
                });
            }
            
            // Check if the click is outside any routine menu or menu button
            const routineMenu = e.target.closest('.routine-menu');
            const routineMenuButton = e.target.closest('.routine-menu-btn');
            
            if (!routineMenu && !routineMenuButton) {
                // Close all open routine menus
                document.querySelectorAll('.routine-menu').forEach(menu => {
                    menu.classList.add('hidden');
                });
            }
        });
        
        // Event delegation for task card interactions
        this.setupTaskEventDelegation();
        
        // Routine management event listeners (add card is now created dynamically)
        
        const routineForm = document.getElementById('routine-form');
        if (routineForm) {
            routineForm.addEventListener('submit', (e) => {
                this.handleRoutineSubmit(e);
            });
        }
        
        const closeRoutineModalBtn = document.getElementById('close-routine-modal');
        if (closeRoutineModalBtn) {
            closeRoutineModalBtn.addEventListener('click', () => {
                this.closeRoutineModal();
            });
        }
        
        const cancelRoutineBtn = document.getElementById('cancel-routine-btn');
        if (cancelRoutineBtn) {
            cancelRoutineBtn.addEventListener('click', () => {
                this.closeRoutineModal();
            });
        }
        
        // Emoji picker button
        const emojiPickerBtn = document.getElementById('emoji-picker-btn');
        if (emojiPickerBtn) {
            emojiPickerBtn.addEventListener('click', () => {
                this.openEmojiPicker();
            });
        }
        
        // Color swatch selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                // Remove selection from all swatches
                document.querySelectorAll('.color-swatch').forEach(swatch => {
                    swatch.classList.remove('border-gray-800', 'ring-2', 'ring-gray-400');
                    swatch.classList.add('border-gray-300');
                });
                
                // Add selection to clicked swatch
                e.target.classList.remove('border-gray-300');
                e.target.classList.add('border-gray-800', 'ring-2', 'ring-gray-400');
                
                // Update the hidden input
                document.getElementById('routine-color').value = e.target.dataset.color;
            }
        });
        
        // Pause toggle button
        const pauseToggleBtn = document.getElementById('pause-toggle-btn');
        if (pauseToggleBtn) {
            pauseToggleBtn.addEventListener('click', () => {
                this.togglePauseState();
            });
        }
        
        // Pause until date change
        const pauseUntilDate = document.getElementById('pause-until-date');
        if (pauseUntilDate) {
            pauseUntilDate.addEventListener('change', (e) => {
                document.getElementById('routine-pause-until').value = e.target.value;
            });
        }
        
        // Achievable checkbox - show/hide completed checkbox
        const achievableCheckbox = document.getElementById('routine-achievable');
        if (achievableCheckbox) {
            achievableCheckbox.addEventListener('change', () => {
                this.toggleCompletedVisibility();
            });
        }
        
        // Completed checkbox - override status controls
        const completedCheckbox = document.getElementById('routine-completed');
        if (completedCheckbox) {
            completedCheckbox.addEventListener('change', () => {
                this.handleCompletedToggle();
            });
        }
        
        // Setup routine pickers for both modals
        this.setupRoutinePicker('task');
        this.setupRoutinePicker('edit-task');
    }

    // Network Connectivity Monitoring
    setupNetworkMonitoring() {
        console.log('🌐 Setting up network connectivity monitoring...');
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('🟢 Network connection restored');
            this.isOnline = true;
            this.connectionLossTime = null;
            this.updateConnectionStatus(true);
            
            // Emit connectivity restored event
            window.dispatchEvent(new CustomEvent('connectionRestored', {
                detail: { timestamp: new Date().toISOString() }
            }));
        });
        
        window.addEventListener('offline', () => {
            console.log('🔴 Network connection lost');
            this.isOnline = false;
            this.connectionLossTime = Date.now();
            this.updateConnectionStatus(false);
            
            // Emit connectivity lost event
            window.dispatchEvent(new CustomEvent('connectionLost', {
                detail: { timestamp: new Date().toISOString() }
            }));
        });
        
        // Periodic connection health check (every 30 seconds when online)
        setInterval(() => {
            if (this.isOnline) {
                this.performHealthCheck();
            }
        }, 30000);
        
        console.log('✅ Network monitoring setup complete');
    }
    
    // Check server connectivity with a lightweight health check
    async performHealthCheck() {
        try {
            const response = await fetch('/health', { 
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }
            
            // Connection is healthy
            if (!this.isOnline) {
                console.log('🔄 Connection status updated to online via health check');
                this.isOnline = true;
                this.connectionLossTime = null;
                this.updateConnectionStatus(true);
            }
            
        } catch (error) {
            // Health check failed - connection may be poor or server down
            if (this.isOnline) {
                console.log('⚠️ Health check failed, but navigator.onLine is true');
                console.log('This may indicate server issues or poor connectivity');
                
                // Don't immediately mark as offline - wait for browser's offline event
                // But we can emit a connectivity warning
                window.dispatchEvent(new CustomEvent('connectionWarning', {
                    detail: { 
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }
                }));
            }
        }
    }
    
    // Update UI based on connection status
    updateConnectionStatus(isOnline) {
        // Add/remove connection status indicator to the page
        let statusIndicator = document.getElementById('connection-status');
        
        if (!statusIndicator) {
            // Create status indicator if it doesn't exist
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'connection-status';
            statusIndicator.className = 'fixed top-16 left-0 right-0 z-40 text-center py-2 text-sm font-medium transition-all duration-300';
            document.body.prepend(statusIndicator);
        }
        
        if (isOnline) {
            statusIndicator.className = 'fixed top-16 left-0 right-0 z-40 text-center py-2 text-sm font-medium transition-all duration-300 bg-green-600 text-white translate-y-0';
            statusIndicator.textContent = '🟢 Connection restored';
            
            // Hide the indicator after 3 seconds
            setTimeout(() => {
                statusIndicator.style.transform = 'translateY(-100%)';
            }, 3000);
        } else {
            statusIndicator.className = 'fixed top-16 left-0 right-0 z-40 text-center py-2 text-sm font-medium transition-all duration-300 bg-red-600 text-white translate-y-0';
            statusIndicator.textContent = '🔴 No internet connection - working offline';
            statusIndicator.style.transform = 'translateY(0)';
        }
    }
    
    // Check if we're currently online
    isConnectionAvailable() {
        return this.isOnline;
    }
    
    // Get connection loss duration in seconds
    getConnectionLossDuration() {
        if (!this.connectionLossTime) return 0;
        return Math.floor((Date.now() - this.connectionLossTime) / 1000);
    }
    
    // Error Boundary and User Feedback System
    setupErrorBoundary() {
        console.log('🛡️ Setting up error boundary system...');
        
        // Track active error notifications
        this.activeErrorNotifications = new Map();
        
        // Listen for network errors
        window.addEventListener('networkError', (event) => {
            const { url, method, error } = event.detail;
            this.showErrorNotification(error, { url, method });
        });
        
        // Listen for connection events
        window.addEventListener('connectionLost', (event) => {
            this.showOfflineNotification();
        });
        
        window.addEventListener('connectionRestored', (event) => {
            this.hideOfflineNotification();
            this.showSuccessNotification('Connection restored! You are now online.');
        });
        
        window.addEventListener('connectionWarning', (event) => {
            const { error } = event.detail;
            this.showWarningNotification(`Network issues detected: ${error}`);
        });
        
        window.addEventListener('requestRetrySuccess', (event) => {
            const { totalRetries } = event.detail;
            this.showSuccessNotification(`Request succeeded after ${totalRetries} retries.`);
        });
        
        console.log('✅ Error boundary system setup complete');
    }
    
    // Show error notification with retry option
    showErrorNotification(error, context = {}) {
        const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create error notification element
        const notification = document.createElement('div');
        notification.id = errorId;
        notification.className = 'fixed bottom-4 right-4 z-50 max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full';
        
        const isRetryable = error.retryable && !error.offline;
        const actionButtons = isRetryable ? 
            `<button class="retry-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 mr-2" data-url="${context.url}" data-method="${context.method}">
                Retry
            </button>` : '';
        
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-1">
                    <div class="font-medium text-sm">
                        ${error.code === 'OFFLINE' ? 'Offline' : 'Network Error'}
                    </div>
                    <div class="text-sm mt-1">
                        ${error.userMessage || error.message}
                    </div>
                    ${error.totalAttempts ? `<div class="text-xs mt-1 opacity-75">Failed after ${error.totalAttempts} attempts</div>` : ''}
                </div>
                <div class="ml-3 flex-shrink-0">
                    ${actionButtons}
                    <button class="dismiss-btn text-red-400 hover:text-red-600" data-error-id="${errorId}">
                        ✕
                    </button>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Setup event listeners
        const retryBtn = notification.querySelector('.retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                // Emit a retry request event
                window.dispatchEvent(new CustomEvent('retryRequest', {
                    detail: { 
                        url: retryBtn.dataset.url,
                        method: retryBtn.dataset.method
                    }
                }));
                this.hideErrorNotification(errorId);
            });
        }
        
        const dismissBtn = notification.querySelector('.dismiss-btn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this.hideErrorNotification(errorId);
            });
        }
        
        // Track the notification
        this.activeErrorNotifications.set(errorId, notification);
        
        // Auto-dismiss after 8 seconds for non-critical errors
        if (error.code !== 'OFFLINE' && !error.finalAttempt) {
            setTimeout(() => {
                this.hideErrorNotification(errorId);
            }, 8000);
        }
        
        return errorId;
    }
    
    // Show success notification
    showSuccessNotification(message, duration = 4000) {
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 z-50 max-w-md bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full';
        
        notification.innerHTML = `
            <div class="flex items-center">
                <div class="flex-1">
                    <div class="text-sm">✅ ${message}</div>
                </div>
                <button class="ml-3 text-green-400 hover:text-green-600 dismiss-success">✕</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Dismiss button
        notification.querySelector('.dismiss-success').addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // Auto-dismiss
        setTimeout(() => {
            this.hideNotification(notification);
        }, duration);
    }
    
    // Show warning notification
    showWarningNotification(message, duration = 6000) {
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 z-50 max-w-md bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full';
        
        notification.innerHTML = `
            <div class="flex items-center">
                <div class="flex-1">
                    <div class="text-sm">⚠️ ${message}</div>
                </div>
                <button class="ml-3 text-yellow-400 hover:text-yellow-600 dismiss-warning">✕</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Dismiss button
        notification.querySelector('.dismiss-warning').addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // Auto-dismiss
        setTimeout(() => {
            this.hideNotification(notification);
        }, duration);
    }
    
    // Show persistent offline notification
    showOfflineNotification() {
        if (document.getElementById('offline-notification')) return; // Already showing
        
        const notification = document.createElement('div');
        notification.id = 'offline-notification';
        notification.className = 'fixed bottom-4 left-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg';
        
        notification.innerHTML = `
            <div class="flex items-center">
                <div class="text-sm">
                    🔴 You are offline - changes will be saved when you reconnect
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
    }
    
    // Hide offline notification
    hideOfflineNotification() {
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.remove();
        }
    }
    
    // Hide error notification
    hideErrorNotification(errorId) {
        const notification = this.activeErrorNotifications.get(errorId);
        if (notification) {
            this.hideNotification(notification);
            this.activeErrorNotifications.delete(errorId);
        }
    }
    
    // Generic notification hiding with animation
    hideNotification(notification) {
        notification.style.transform = 'translateX(full)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    // Enhanced error messages for common scenarios
    getContextualErrorMessage(error, context = {}) {
        const { url, method } = context;
        
        if (error.code === 'OFFLINE') {
            return 'You appear to be offline. Please check your internet connection and try again.';
        }
        
        if (error.code === 'NETWORK_TIMEOUT') {
            return 'The request is taking longer than expected. This might be due to a slow connection or server issues.';
        }
        
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return 'Too many requests. Please wait a moment before trying again.';
        }
        
        if (error.status === 404) {
            if (url && url.includes('/tasks/')) {
                return 'The requested task could not be found. It may have been deleted by another user.';
            }
            if (url && url.includes('/routines/')) {
                return 'The requested routine could not be found. It may have been deleted by another user.';
            }
            return 'The requested resource was not found.';
        }
        
        if (error.status === 500) {
            return 'A server error occurred. Our team has been notified and is working on a fix.';
        }
        
        return error.userMessage || error.message || 'An unexpected error occurred. Please try again.';
    }
    
    // Event Delegation System for Task Cards
    setupTaskEventDelegation() {
        console.log('🎯 Setting up task event delegation...');
        
        // Single delegated click handler for all task card interactions
        document.addEventListener('click', (e) => {
            // Task completion button
            if (e.target.matches(`.${ClioBoardApp.CSS_CLASSES.TASK_COMPLETE_BTN}`) || e.target.closest(`.${ClioBoardApp.CSS_CLASSES.TASK_COMPLETE_BTN}`)) {
                const completeBtn = e.target.closest(`.${ClioBoardApp.CSS_CLASSES.TASK_COMPLETE_BTN}`);
                const taskCard = completeBtn.closest(`.${ClioBoardApp.CSS_CLASSES.TASK_CARD}`);
                const taskId = parseInt(taskCard.dataset.taskId);
                const task = this.findTaskById(taskId);
                
                if (!task) return;
                
                e.stopPropagation();
                
                // Double-click protection
                if (this.pendingToggles.has(task.id)) {
                    console.log(`⏳ Ignoring click on ${task.id} - already pending`);
                    return;
                }
                
                const newStatus = task.status === ClioBoardApp.TASK_STATUS.COMPLETED ? ClioBoardApp.TASK_STATUS.PENDING : ClioBoardApp.TASK_STATUS.COMPLETED;
                
                // Mark as pending
                this.pendingToggles.add(task.id);
                
                // Cancel existing request
                const existingController = this.abortControllers.get(task.id);
                if (existingController) {
                    existingController.abort();
                }
                
                // Optimistic UI update
                const oldStatus = task.status;
                task.status = newStatus;
                this.updateTaskCardCompletionUI(taskCard, newStatus);
                
                // Trigger confetti if completing
                if (newStatus === ClioBoardApp.TASK_STATUS.COMPLETED) {
                    this.triggerTaskCompletionConfetti(completeBtn);
                }
                
                // Handle toggle with error recovery
                this.handleTaskToggleOptimistic(task.id, newStatus, oldStatus, taskCard);
                return;
            }
            
            // Task menu button
            if (e.target.matches('.task-menu-btn') || e.target.closest('.task-menu-btn')) {
                const menuBtn = e.target.closest('.task-menu-btn');
                const taskCard = menuBtn.closest('.task-card');
                const menu = taskCard.querySelector('.task-menu');
                
                e.stopPropagation();
                
                // Close other menus
                document.querySelectorAll('.task-menu').forEach(m => {
                    if (m !== menu) m.classList.add('hidden');
                });
                
                // Toggle this menu
                if (menu) menu.classList.toggle('hidden');
                return;
            }
            
            // Archive button
            if (e.target.matches('.archive-task-btn') || e.target.closest('.archive-task-btn')) {
                const archiveBtn = e.target.closest('.archive-task-btn');
                const taskCard = archiveBtn.closest('.task-card');
                const taskId = parseInt(taskCard.dataset.taskId);
                
                e.stopPropagation();
                
                this.handleTaskArchive(taskId);
                
                // Close menu
                const menu = taskCard.querySelector('.task-menu');
                if (menu) menu.classList.add('hidden');
                return;
            }
            
            // Expand button
            if (e.target.matches('.expand-btn') || e.target.closest('.expand-btn')) {
                const expandBtn = e.target.closest('.expand-btn');
                const taskCard = expandBtn.closest('.task-card');
                const taskId = parseInt(taskCard.dataset.taskId);
                const hiddenItems = taskCard.querySelector('.hidden-items');
                const collapseBtn = taskCard.querySelector('.collapse-btn');
                
                e.stopPropagation();
                
                this.expandedLists.add(taskId);
                if (hiddenItems) hiddenItems.classList.remove('hidden');
                expandBtn.classList.add('hidden');
                if (collapseBtn) collapseBtn.classList.remove('hidden');
                return;
            }
            
            // Collapse button
            if (e.target.matches('.collapse-btn') || e.target.closest('.collapse-btn')) {
                const collapseBtn = e.target.closest('.collapse-btn');
                const taskCard = collapseBtn.closest('.task-card');
                const taskId = parseInt(taskCard.dataset.taskId);
                const hiddenItems = taskCard.querySelector('.hidden-items');
                const expandBtn = taskCard.querySelector('.expand-btn');
                
                e.stopPropagation();
                
                this.expandedLists.delete(taskId);
                if (hiddenItems) hiddenItems.classList.add('hidden');
                collapseBtn.classList.add('hidden');
                if (expandBtn) expandBtn.classList.remove('hidden');
                return;
            }
            
            // Routine tag click (for global toggle - Trello-style)
            if (e.target.matches('.routine-tag, .routine-tag-minimized') || e.target.closest('.routine-tag, .routine-tag-minimized')) {
                e.stopPropagation();
                this.toggleRoutineTagsDisplay();
                return;
            }
            
            // Task card click (for edit)
            if (e.target.closest('.task-card')) {
                const taskCard = e.target.closest('.task-card');
                const taskId = parseInt(taskCard.dataset.taskId);
                const task = this.findTaskById(taskId);
                
                if (!task) return;
                
                // Only handle if not clicking on other interactive elements
                if (!e.target.closest('.task-complete-btn, .task-menu-btn, .expand-btn, .collapse-btn, .routine-tag, .list-item-checkbox, .archive-task-btn')) {
                    this.handleTaskClick(e, task);
                }
                return;
            }
        });
        
        // Separate delegated handler for checkboxes (change event)
        document.addEventListener('change', (e) => {
            if (e.target.matches('.list-item-checkbox')) {
                e.stopPropagation();
                const taskId = e.target.dataset.taskId;
                const itemId = e.target.dataset.itemId;
                this.handleItemToggle(e, taskId, itemId);
            }
        });
        
        console.log('✅ Task event delegation setup complete');
    }
    
    // Helper method to find task by ID
    findTaskById(id) {
        return this.tasks.find(task => task.id === id) || 
               this.archivedTasks.find(task => task.id === id);
    }

    // Routine Picker Methods
    setupRoutinePicker(prefix) {
        const button = document.getElementById(`${prefix}-routine-btn`);
        const picker = document.getElementById(`${prefix}-routine-picker`);
        const search = document.getElementById(`${prefix}-routine-search`);
        
        if (!button || !picker || !search) return;
        
        // Button click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = !picker.classList.contains('hidden');
            
            // Close all other pickers
            document.querySelectorAll('[id$="-routine-picker"]').forEach(p => {
                if (p !== picker) p.classList.add('hidden');
            });
            
            if (isOpen) {
                picker.classList.add('hidden');
            } else {
                this.populateRoutinePicker(prefix);
                
                // Position the picker dynamically to escape modal overflow constraints
                this.positionRoutinePicker(picker, button);
                
                picker.classList.remove('hidden');
                search.focus();
                
                // No need for virtual selection since options are now focusable
            }
        });
        
        // Button keyboard handler - open picker on arrow keys or Enter
        button.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                
                // Open the picker if not already open
                if (picker.classList.contains('hidden')) {
                    // Close all other pickers
                    document.querySelectorAll('[id$="-routine-picker"]').forEach(p => {
                        if (p !== picker) p.classList.add('hidden');
                    });
                    
                    this.populateRoutinePicker(prefix);
                    
                    // Position the picker dynamically to escape modal overflow constraints
                    this.positionRoutinePicker(picker, button);
                    
                    picker.classList.remove('hidden');
                    search.focus();
                    
                    // If down arrow, user can press Tab to move to options
                }
            }
        });
        
        // Search input handler
        search.addEventListener('input', (e) => {
            this.filterRoutinePicker(prefix, e.target.value);
        });
        
        // Search field keyboard handler - only Tab and Escape
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                // Move focus to first visible routine option
                e.preventDefault();
                const optionsContainer = document.getElementById(`${prefix}-routine-options`);
                const visibleOptions = Array.from(optionsContainer.querySelectorAll('.routine-option:not([style*="display: none"])[tabindex="0"]'));
                if (visibleOptions.length > 0) {
                    visibleOptions[0].focus();
                }
            } else if (e.key === 'Escape') {
                // Close picker and return focus to button
                const picker = document.getElementById(`${prefix}-routine-picker`);
                if (picker) {
                    picker.classList.add('hidden');
                    this.resetRoutinePickerPosition(picker);
                    const button = document.getElementById(`${prefix}-routine-btn`);
                    if (button) button.focus();
                }
            }
        });
        
        // Setup edit panel event listeners
        this.setupRoutineEditListeners(prefix);
        
        // Add Enter key handlers for both Add and Edit Task Modals
        this.setupAddTaskKeyHandlers();
        this.setupEditTaskKeyHandlers();
        this.setupEditTaskMenuHandlers();
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!button.contains(e.target) && !picker.contains(e.target)) {
                picker.classList.add('hidden');
                this.resetRoutinePickerPosition(picker);
            }
        });
        
        // Close on escape key (handled by existing ESC handler)
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                picker.classList.add('hidden');
                button.focus();
            }
        });
    }
    
    async populateRoutinePicker(prefix) {
        try {
            const optionsContainer = document.getElementById(`${prefix}-routine-options`);
            if (!optionsContainer) return;
            
            // Get active and paused routines
            const routines = await this.apiCall('/api/routines');
            const availableRoutines = routines.filter(routine => 
                !routine.is_archived && 
                (routine.status === 'active' || routine.status === 'paused')
            );
            
            // Sort routines by display_order (same as Routines page)
            availableRoutines.sort((a, b) => {
                // If both have display_order, sort by that
                if (a.display_order !== null && b.display_order !== null) {
                    return a.display_order - b.display_order;
                }
                // If only one has display_order, it comes first
                if (a.display_order !== null) return -1;
                if (b.display_order !== null) return 1;
                // Otherwise sort by creation date (oldest first)
                return new Date(a.created_at) - new Date(b.created_at);
            });
            
            // Clear existing options
            optionsContainer.innerHTML = '';
            
            // Add "No routine" option
            const noRoutineOption = this.createRoutineOption(null, prefix);
            optionsContainer.appendChild(noRoutineOption);
            
            // Add routine options
            availableRoutines.forEach(routine => {
                const option = this.createRoutineOption(routine, prefix);
                optionsContainer.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading routines for picker:', error);
        }
    }
    
    createRoutineOption(routine, prefix) {
        const div = document.createElement('div');
        
        if (!routine) {
            div.className = 'routine-option group py-1 px-2 cursor-pointer flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 focus:bg-blue-100 border-l-3 border-gray-300';
            div.tabIndex = 0; // Make focusable
            div.dataset.routineId = '';
            div.dataset.prefix = prefix;
            
            div.innerHTML = `
                <div class="w-3 h-1.5 bg-gray-300 rounded-sm"></div>
                <span class="text-xs text-gray-600 font-medium">No routine</span>
            `;
        } else {
            // Get background color for full-width styling
            let backgroundColor = '';
            let textColor = '';
            let borderColor = '';
            
            if (routine.color === 'brown') {
                backgroundColor = 'rgba(232, 216, 207, 0.3)';
                textColor = '#73513b';
                borderColor = '#e8d8cf';
            } else {
                const colorMap = {
                    blue: { bg: 'rgba(59, 130, 246, 0.1)', text: '#1e40af', border: '#3b82f6' },
                    green: { bg: 'rgba(34, 197, 94, 0.1)', text: '#166534', border: '#22c55e' },
                    purple: { bg: 'rgba(168, 85, 247, 0.1)', text: '#7c3aed', border: '#a855f7' },
                    orange: { bg: 'rgba(249, 115, 22, 0.1)', text: '#ea580c', border: '#f97316' },
                    red: { bg: 'rgba(239, 68, 68, 0.1)', text: '#dc2626', border: '#ef4444' },
                    yellow: { bg: 'rgba(234, 179, 8, 0.1)', text: '#a16207', border: '#eab308' },
                    pink: { bg: 'rgba(236, 72, 153, 0.1)', text: '#be185d', border: '#ec4899' },
                    gray: { bg: 'rgba(107, 114, 128, 0.1)', text: '#374151', border: '#6b7280' },
                    teal: { bg: 'rgba(20, 184, 166, 0.1)', text: '#0f766e', border: '#14b8a6' },
                    lime: { bg: 'rgba(132, 204, 22, 0.1)', text: '#365314', border: '#84cc16' },
                    black: { bg: 'rgba(55, 65, 81, 0.1)', text: '#111827', border: '#374151' }
                };
                const colors = colorMap[routine.color] || colorMap.blue;
                backgroundColor = colors.bg;
                textColor = colors.text;
                borderColor = colors.border;
            }
            
            div.className = 'routine-option group py-1 px-2 cursor-pointer flex items-center justify-between border-l-3 focus:bg-blue-100';
            div.tabIndex = 0; // Make focusable
            div.style.backgroundColor = backgroundColor;
            div.style.borderLeftColor = borderColor;
            div.dataset.routineId = routine.id;
            div.dataset.prefix = prefix;
            
            div.innerHTML = `
                <div class="flex items-center space-x-2 flex-1">
                    <span class="text-xs" style="color: ${textColor}">${routine.icon || '⭐'}</span>
                    <div class="flex items-center space-x-1.5">
                        <span class="text-xs font-medium" style="color: ${textColor}">${this.escapeHtml(routine.title)}</span>
                        ${routine.status === 'paused' ? '<span class="text-xs text-gray-500">[<span style="font-size: 9px;">⏸</span> Paused]</span>' : ''}
                    </div>
                </div>
                <button class="edit-routine-btn p-1 hover:bg-white hover:bg-opacity-100 hover:border hover:border-gray-300 rounded transition-all group/edit flex items-center space-x-1" data-routine-id="${routine.id}" data-prefix="${prefix}" tabindex="-1">
                    <span class="text-xs font-medium opacity-0 group-hover/edit:opacity-100 transition-opacity whitespace-nowrap" style="color: ${textColor}">Edit</span>
                    <i class="fas fa-edit text-xs" style="color: ${textColor}"></i>
                </button>
            `;
        }
        
        // Add click handler for routine selection
        div.addEventListener('click', (e) => {
            // Don't select if clicking the edit button
            if (e.target.closest('.edit-routine-btn')) {
                return;
            }
            this.selectRoutineOption(prefix, routine);
        });
        
        // Add click handler for edit button (only for actual routines, not "No routine")
        if (routine) {
            const editBtn = div.querySelector('.edit-routine-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.openRoutineEdit(routine.id, prefix);
                });
            }
        }
        
        // Add keyboard handler for focus and navigation
        div.addEventListener('keydown', (e) => {
            const optionsContainer = div.parentElement;
            // Only include visible options for navigation
            const visibleOptions = Array.from(optionsContainer.querySelectorAll('.routine-option[tabindex="0"]:not([style*="display: none"])'));
            const currentIndex = visibleOptions.indexOf(div);
            
            switch(e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    this.selectRoutineOption(prefix, routine);
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    const nextIndex = currentIndex < visibleOptions.length - 1 ? currentIndex + 1 : 0;
                    if (visibleOptions[nextIndex]) {
                        visibleOptions[nextIndex].focus();
                    }
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleOptions.length - 1;
                    if (visibleOptions[prevIndex]) {
                        visibleOptions[prevIndex].focus();
                    }
                    break;
                    
                case 'Escape':
                    e.preventDefault();
                    const picker = document.getElementById(`${prefix}-routine-picker`);
                    if (picker) {
                        picker.classList.add('hidden');
                        this.resetRoutinePickerPosition(picker);
                        const button = document.getElementById(`${prefix}-routine-btn`);
                        if (button) button.focus();
                    }
                    break;
            }
        });
        
        return div;
    }
    
    selectRoutineOption(prefix, routine) {
        const hiddenInput = document.getElementById(`${prefix}-routine`);
        const displaySpan = document.getElementById(`${prefix}-routine-display`);
        const picker = document.getElementById(`${prefix}-routine-picker`);
        
        // Update hidden input
        hiddenInput.value = routine ? routine.id : '';
        
        // Update display
        if (!routine) {
            displaySpan.innerHTML = '<span class="text-gray-500">No routine</span>';
        } else {
            // Handle custom brown color for display
            let colorStyle = '';
            let colorClass = '';
            
            if (routine.color === 'brown') {
                colorStyle = 'style="background-color: #e8d8cf; color: #73513b;"';
            } else {
                const colorMap = {
                    blue: 'bg-blue-100 text-blue-700',
                    green: 'bg-green-200 text-green-800',
                    purple: 'bg-purple-100 text-purple-700',
                    orange: 'bg-orange-100 text-orange-700',
                    red: 'bg-red-100 text-red-700',
                    yellow: 'bg-yellow-100 text-yellow-700',
                    pink: 'bg-pink-100 text-pink-700',
                    gray: 'bg-gray-100 text-gray-700',
                    teal: 'bg-teal-100 text-teal-700',
                    lime: 'bg-lime-50 text-lime-700',
                    black: 'bg-gray-800 text-white'
                };
                colorClass = colorMap[routine.color] || colorMap.blue;
            }
            
            displaySpan.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${colorClass}" ${colorStyle}>
                        <span>${routine.icon || '⭐'}</span>
                        <span>${this.escapeHtml(routine.title)}</span>
                    </div>
                    ${routine.status === 'paused' ? '<span class="text-xs text-gray-500">▐▐ PAUSED</span>' : ''}
                </div>
            `;
        }
        
        // Close picker
        picker.classList.add('hidden');
        
        // Clear search
        const search = document.getElementById(`${prefix}-routine-search`);
        if (search) search.value = '';
        
        // Move focus to the next field (Notes textarea)
        const notesField = document.getElementById(prefix === 'task' ? 'task-notes' : 'edit-task-notes');
        if (notesField) {
            notesField.focus();
        }
    }
    
    setupRoutineEditListeners(prefix) {
        // Back button
        const backBtn = document.querySelector(`[data-prefix="${prefix}"].routine-edit-back-btn`);
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeRoutineEdit(prefix);
            });
        }
        
        // Save button
        const saveBtn = document.querySelector(`[data-prefix="${prefix}"].routine-edit-save-btn`);
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.saveRoutineEdit(prefix);
            });
        }
        
        
        // Icon input Enter key handler
        const iconInput = document.getElementById(`${prefix}-edit-routine-icon`);
        if (iconInput) {
            iconInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.saveRoutineEdit(prefix);
                }
            });
        }
        
        // Title input Enter key handler
        const titleInput = document.getElementById(`${prefix}-edit-routine-title`);
        if (titleInput) {
            titleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.saveRoutineEdit(prefix);
                }
            });
        }
    }
    
    setupAddTaskKeyHandlers() {
        // Only set up once
        if (this.addTaskKeyHandlersSetup) return;
        this.addTaskKeyHandlersSetup = true;
        
        // Enter key on title field saves the task
        const addTaskTitle = document.getElementById('task-title');
        if (addTaskTitle) {
            addTaskTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const form = document.getElementById('add-task-form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            });
        }
        
        // Ctrl+Enter on notes field saves the task
        const addTaskNotes = document.getElementById('task-notes');
        if (addTaskNotes) {
            addTaskNotes.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    const form = document.getElementById('add-task-form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            });
        }
    }
    
    setupEditTaskMenuHandlers() {
        // Only set up once
        if (this.editTaskMenuHandlersSetup) return;
        this.editTaskMenuHandlersSetup = true;
        
        const menuBtn = document.getElementById('edit-task-menu-btn');
        const menu = document.getElementById('edit-task-menu');
        const archiveBtn = document.getElementById('archive-from-modal-btn');
        
        if (menuBtn && menu) {
            // Toggle menu on button click
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!menuBtn.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        }
        
        if (archiveBtn) {
            archiveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.archiveTaskFromModal();
            });
        }
    }
    
    async archiveTaskFromModal() {
        if (!this.editingTask) return;
        
        try {
            await this.apiCall(`/api/tasks/${this.editingTask.id}/archive`, {
                method: 'PUT'
            });
            
            // Close the modal
            this.closeEditTaskModal();
            
            // Refresh both tasks and board display
            await this.loadTasks();
            this.renderBoard();
            
            console.log('✅ Task archived from modal');
        } catch (error) {
            console.error('Error archiving task from modal:', error);
            alert('Failed to archive task. Please try again.');
        }
    }
    
    setupEditTaskKeyHandlers() {
        // Only set up once
        if (this.editTaskKeyHandlersSetup) return;
        this.editTaskKeyHandlersSetup = true;
        
        // Enter key on title field saves the task
        const editTaskTitle = document.getElementById('edit-task-title');
        if (editTaskTitle) {
            editTaskTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const form = document.getElementById('edit-task-form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            });
        }
        
        // Ctrl+Enter in notes field saves the task
        const editTaskNotes = document.getElementById('edit-task-notes');
        if (editTaskNotes) {
            editTaskNotes.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    const form = document.getElementById('edit-task-form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                }
            });
        }
    }
    
    setupListItemKeyHandlers(input, formId) {
        // Add Enter/Ctrl+Enter key support for list item inputs
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                e.preventDefault();
                // Submit the form
                const form = document.getElementById(formId);
                if (form) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }
        });
    }
    
    initializeListSorting(containerId) {
        const container = document.getElementById(containerId);
        if (!container || container.dataset.sortingInitialized) return;
        
        container.dataset.sortingInitialized = 'true';
        let draggedElement = null;
        
        // Handle drag start - only from drag handle
        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('drag-handle') || e.target.closest('.drag-handle')) {
                const row = e.target.closest('.list-item-row');
                if (row) {
                    draggedElement = row;
                    row.style.opacity = '0.5';
                    row.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', ''); // Required for drag to work
                }
            }
        });
        
        // Handle drag end
        container.addEventListener('dragend', (e) => {
            const row = e.target.closest('.list-item-row');
            if (row) {
                row.style.opacity = '';
                row.classList.remove('dragging');
                draggedElement = null;
            }
        });
        
        // Handle drag over
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        // Handle drop
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (draggedElement) {
                const afterElement = this.getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(draggedElement);
                } else {
                    container.insertBefore(draggedElement, afterElement);
                }
                
                // Update order indices for all items
                this.updateListItemOrder(containerId);
            }
        });
    }
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.list-item-row:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    updateListItemOrder(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Add order attribute to all list items based on their current position
        const listItems = container.querySelectorAll('.list-item-row');
        listItems.forEach((item, index) => {
            const input = item.querySelector('input[type="text"]');
            if (input) {
                input.dataset.order = index;
            }
        });
    }
    
    filterRoutinePicker(prefix, searchTerm) {
        const optionsContainer = document.getElementById(`${prefix}-routine-options`);
        if (!optionsContainer) return;
        
        const options = optionsContainer.querySelectorAll('.routine-option');
        const term = searchTerm.toLowerCase().trim();
        
        options.forEach(option => {
            const routineId = option.dataset.routineId;
            
            // Always show "No routine" option
            if (!routineId) {
                option.style.display = 'flex';
                return;
            }
            
            const text = option.textContent.toLowerCase();
            const matches = !term || text.includes(term);
            option.style.display = matches ? 'flex' : 'none';
        });
        
        // Filtering complete - user can Tab to focus options as needed
    }
    
    positionRoutinePicker(picker, button) {
        // Get button position relative to viewport
        const buttonRect = button.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        // Reset positioning classes/styles
        picker.style.position = 'fixed';
        picker.style.left = buttonRect.left + 'px';
        picker.style.width = buttonRect.width + 'px';
        picker.style.maxHeight = Math.min(400, spaceBelow - 10) + 'px'; // Leave 10px margin
        
        // Position below button if there's space, otherwise above
        if (spaceBelow > 200) {
            picker.style.top = (buttonRect.bottom + 4) + 'px';
            picker.style.bottom = 'auto';
        } else {
            picker.style.bottom = (viewportHeight - buttonRect.top + 4) + 'px';
            picker.style.top = 'auto';
            picker.style.maxHeight = Math.min(400, spaceAbove - 10) + 'px';
        }
    }
    
    resetRoutinePickerPosition(picker) {
        // Reset to original CSS positioning
        picker.style.position = '';
        picker.style.left = '';
        picker.style.top = '';
        picker.style.bottom = '';
        picker.style.width = '';
        picker.style.maxHeight = '';
    }
    
    async setRoutinePickerSelection(prefix, routineId) {
        const hiddenInput = document.getElementById(`${prefix}-routine`);
        const displaySpan = document.getElementById(`${prefix}-routine-display`);
        
        if (!hiddenInput || !displaySpan) return;
        
        // Set hidden input value
        hiddenInput.value = routineId || '';
        
        if (!routineId) {
            // No routine selected
            displaySpan.innerHTML = '<span class="text-gray-500">No routine</span>';
            return;
        }
        
        try {
            // Find the routine from the cache or API
            let routine = this.routines.find(r => r.id === routineId);
            if (!routine) {
                // Fetch routines if not cached
                const routines = await this.apiCall('/api/routines');
                routine = routines.find(r => r.id === routineId);
            }
            
            if (routine) {
                this.selectRoutineOption(prefix, routine);
            } else {
                // Routine not found, reset to "No routine"
                displaySpan.innerHTML = '<span class="text-gray-500">No routine</span>';
                hiddenInput.value = '';
            }
        } catch (error) {
            console.error('Error setting routine picker selection:', error);
            displaySpan.innerHTML = '<span class="text-gray-500">No routine</span>';
            hiddenInput.value = '';
        }
    }

    // Routine Inline Editing Methods
    openRoutineEdit(routineId, prefix) {
        console.log('Opening routine edit for:', routineId, 'in prefix:', prefix);
        
        const routine = this.routines.find(r => r.id === routineId);
        if (!routine) {
            console.error('Routine not found:', routineId);
            return;
        }
        
        // Store current editing state
        this.currentEditingRoutine = { id: routineId, prefix: prefix };
        
        // Hide main picker view and show edit panel
        const mainView = document.getElementById(`${prefix}-routine-main`);
        const editView = document.getElementById(`${prefix}-routine-edit`);
        
        if (mainView && editView) {
            mainView.classList.add('hidden');
            editView.classList.remove('hidden');
            
            // Populate edit form
            this.populateRoutineEditForm(routine, prefix);
        }
    }
    
    closeRoutineEdit(prefix) {
        console.log('Closing routine edit for prefix:', prefix);
        
        // Show main picker view and hide edit panel
        const mainView = document.getElementById(`${prefix}-routine-main`);
        const editView = document.getElementById(`${prefix}-routine-edit`);
        
        if (mainView && editView) {
            mainView.classList.remove('hidden');
            editView.classList.add('hidden');
        }
        
        // Clear editing state
        this.currentEditingRoutine = null;
    }
    
    populateRoutineEditForm(routine, prefix) {
        // Populate icon field
        const iconInput = document.getElementById(`${prefix}-edit-routine-icon`);
        if (iconInput) {
            iconInput.value = routine.icon || '⭐';
        }
        
        // Populate title field
        const titleInput = document.getElementById(`${prefix}-edit-routine-title`);
        if (titleInput) {
            titleInput.value = routine.title;
        }
        
        // Populate color picker
        this.populateColorPicker(routine.color, prefix);
    }
    
    populateColorPicker(selectedColor, prefix) {
        const colorsContainer = document.getElementById(`${prefix}-edit-routine-colors`);
        if (!colorsContainer) return;
        
        const colors = [
            { name: 'blue', value: '#3498db' },
            { name: 'green', value: '#2ecc71' },
            { name: 'purple', value: '#9b59b6' },
            { name: 'orange', value: '#e67e22' },
            { name: 'red', value: '#e74c3c' },
            { name: 'yellow', value: '#f1c40f' },
            { name: 'pink', value: '#e91e63' },
            { name: 'gray', value: '#95a5a6' },
            { name: 'teal', value: '#1abc9c' },
            { name: 'lime', value: '#32cd32' },
            { name: 'brown', value: '#8b4513' },
            { name: 'black', value: '#2c3e50' }
        ];
        
        colorsContainer.innerHTML = colors.map(color => `
            <button type="button" 
                    class="color-picker-btn w-6 h-6 rounded border-2 ${selectedColor === color.name ? 'border-gray-800 scale-110' : 'border-gray-300 hover:border-gray-400'} transition-all"
                    style="background-color: ${color.value}"
                    data-color="${color.name}"
                    data-prefix="${prefix}"
                    title="${color.name}">
            </button>
        `).join('');
        
        // Add event listeners to color buttons
        colorsContainer.querySelectorAll('.color-picker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const colorName = btn.dataset.color;
                const prefix = btn.dataset.prefix;
                this.selectEditColor(colorName, prefix);
            });
        });
    }
    
    async selectEditColor(colorName, prefix) {
        // Update the visual selection
        this.populateColorPicker(colorName, prefix);
        // Store the selected color for saving
        this.selectedEditColor = colorName;
        
        // Auto-save the color change immediately
        await this.saveRoutineColor(colorName);
    }
    
    async saveRoutineColor(colorName) {
        if (!this.currentEditingRoutine) return;
        
        try {
            const updateData = { color: colorName };
            
            console.log('Auto-saving routine color:', updateData);
            
            const updatedRoutine = await this.apiCall(`/api/routines/${this.currentEditingRoutine.id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            // Update local cache
            const routineIndex = this.routines.findIndex(r => r.id === this.currentEditingRoutine.id);
            if (routineIndex !== -1) {
                this.routines[routineIndex] = updatedRoutine;
            }
            
            // Refresh the routine picker display and force board re-render
            await this.loadRoutines();
            this.renderBoard();
            
            // Update the routine picker display for the current editing prefix
            if (this.currentEditingRoutine && this.currentEditingRoutine.prefix) {
                this.updateRoutinePickerDisplay(this.currentEditingRoutine.prefix);
            }
            
            console.log('✅ Routine color auto-saved successfully');
        } catch (error) {
            console.error('Error auto-saving routine color:', error);
            alert('Failed to save color. Please try again.');
        }
    }
    
    async saveRoutineEdit(prefix) {
        if (!this.currentEditingRoutine) return;
        
        const iconInput = document.getElementById(`${prefix}-edit-routine-icon`);
        const titleInput = document.getElementById(`${prefix}-edit-routine-title`);
        const newIcon = iconInput?.value?.trim() || '⭐';
        const newTitle = titleInput?.value?.trim();
        
        if (!newTitle) {
            alert('Please enter a routine title');
            return;
        }
        
        try {
            // Save both icon and title (color is auto-saved separately)
            const updateData = { 
                title: newTitle,
                icon: newIcon
            };
            
            console.log('Saving routine:', updateData);
            
            const updatedRoutine = await this.apiCall(`/api/routines/${this.currentEditingRoutine.id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            // Update local cache
            const routineIndex = this.routines.findIndex(r => r.id === this.currentEditingRoutine.id);
            if (routineIndex !== -1) {
                this.routines[routineIndex] = updatedRoutine;
            }
            
            // Refresh the picker options
            this.populateRoutinePicker(prefix);
            
            // Close edit panel
            this.closeRoutineEdit(prefix);
            
            // Refresh the board if this routine is displayed
            this.renderBoard();
            
        } catch (error) {
            console.error('Failed to save routine:', error);
            alert('Failed to save routine changes');
        }
    }
    
    async deleteRoutineFromEdit(prefix) {
        if (!this.currentEditingRoutine) return;
        
        const routine = this.routines.find(r => r.id === this.currentEditingRoutine.id);
        if (!routine) return;
        
        if (!confirm(`Are you sure you want to delete the routine "${routine.title}"? This will remove the routine from all tasks.`)) {
            return;
        }
        
        try {
            await this.apiCall(`/api/routines/${this.currentEditingRoutine.id}/archive`, {
                method: 'PUT'
            });
            
            // Remove from local cache
            this.routines = this.routines.filter(r => r.id !== this.currentEditingRoutine.id);
            
            // Refresh the picker options
            this.populateRoutinePicker(prefix);
            
            // Close edit panel
            this.closeRoutineEdit(prefix);
            
            // Refresh the board
            this.renderBoard();
            
        } catch (error) {
            console.error('Failed to delete routine:', error);
            alert('Failed to delete routine');
        }
    }

    handleTaskClick(event, task) {
        // Prevent handling if clicking on interactive elements
        if (event.target.type === 'checkbox' || event.target.closest('button')) {
            return;
        }
        
        console.log('Task clicked:', task.title);
        this.openEditTaskModal(task);
    }

    updateListItemCount(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || !task.list_items) return;
        
        const completed = task.list_items.filter(item => item.completed).length;
        const total = task.list_items.length;
        
        // Find the count display element for this task
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
            // Look for the span containing the list icon and count
            const countSpan = taskCard.querySelector('span .fa-list')?.parentElement;
            if (countSpan) {
                countSpan.innerHTML = `<i class="fas fa-list mr-1"></i>${completed}/${total}`;
            }
        }
    }

    updateTaskCardCompletionUI(taskCard, newStatus) {
        const completeBtn = taskCard.querySelector ? taskCard.querySelector('.task-complete-btn') : taskCard;
        const taskTitle = taskCard.querySelector ? taskCard.querySelector('h3') : taskCard.closest('.task-card')?.querySelector('h3');
        
        if (completeBtn) {
            if (newStatus === 'completed') {
                // Update button appearance for completed state
                completeBtn.classList.remove('opacity-0', 'group-hover:opacity-100', 'border-gray-300');
                completeBtn.classList.add('opacity-100', 'bg-green-500', 'border-green-500');
                completeBtn.innerHTML = '<i class="fas fa-check text-white text-xs"></i>';
            } else {
                // Update button appearance for pending state
                completeBtn.classList.remove('opacity-100', 'bg-green-500', 'border-green-500');
                completeBtn.classList.add('opacity-0', 'group-hover:opacity-100', 'border-gray-300');
                completeBtn.innerHTML = '';
            }
        }
        
        if (taskTitle) {
            if (newStatus === 'completed') {
                taskTitle.classList.add('text-gray-500', 'line-through', 'ml-6');
                taskTitle.classList.remove('text-gray-900', 'group-hover:ml-6');
            } else {
                taskTitle.classList.remove('text-gray-500', 'line-through', 'ml-6');
                taskTitle.classList.add('text-gray-900', 'group-hover:ml-6');
            }
        }
    }

    async handleItemToggle(event, taskId, itemId) {
        event.stopPropagation();
        const completed = event.target.checked;
        const checkbox = event.target;
        const listItem = checkbox.closest('.flex');
        
        try {
            await this.toggleItemComplete(taskId, itemId, completed);
            
            // Update just this list item's appearance without re-rendering
            if (listItem) {
                const textSpan = listItem.querySelector('span');
                if (textSpan) {
                    if (completed) {
                        textSpan.classList.add('line-through', 'text-gray-500');
                        textSpan.classList.remove('text-gray-700');
                    } else {
                        textSpan.classList.remove('line-through', 'text-gray-500');
                        textSpan.classList.add('text-gray-700');
                    }
                }
            }
            
            // Update the task's list_items in memory
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.list_items) {
                const item = task.list_items.find(i => i.id === itemId);
                if (item) {
                    item.completed = completed;
                }
            }
            
            // Update the list count display without full re-render
            this.updateListItemCount(taskId);
            
        } catch (error) {
            console.error('Failed to toggle item:', error);
            // Revert checkbox state
            event.target.checked = !completed;
        }
    }

    async handleTaskToggle(taskId, newStatus) {
        try {
            console.log(`🔄 Toggling task ${taskId} to ${newStatus}`);
            
            await this.apiCall(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            
            // Refresh board to show updated status and update routine counts
            await this.loadTasks();
            await this.loadRoutines(); // Refresh routine task counts
            this.renderBoard();
        } catch (error) {
            console.error('Failed to toggle task completion:', error);
            this.showError('Failed to update task');
        }
    }

    async handleTaskToggleOptimistic(taskId, newStatus, oldStatus, taskCardDiv) {
        const controller = new AbortController();
        this.abortControllers.set(taskId, controller);
        
        try {
            console.log(`🚀 Optimistic toggle: ${taskId} to ${newStatus}`);
            
            await this.apiCall(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
                signal: controller.signal
            });
            
            console.log(`✅ Toggle successful: ${taskId}`);
            
            // Update routine counts without full re-render
            await this.loadRoutines();
            this.updateTaskCounts();
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`🚫 Toggle aborted: ${taskId}`);
                return; // Don't revert UI if request was cancelled
            }
            
            console.error(`❌ Toggle failed: ${taskId}`, error);
            
            // Revert optimistic changes
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = oldStatus;
                this.updateTaskCardCompletionUI(taskCardDiv, oldStatus);
            }
            
            this.showError('Failed to update task - reverted changes');
            
        } finally {
            // Clean up pending state
            this.pendingToggles.delete(taskId);
            this.abortControllers.delete(taskId);
        }
    }

    async handleTaskToggleOptimisticModal(taskId, newStatus, oldStatus) {
        const controller = new AbortController();
        this.abortControllers.set(taskId, controller);
        
        try {
            console.log(`🚀 Optimistic modal toggle: ${taskId} to ${newStatus}`);
            
            await this.apiCall(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
                signal: controller.signal
            });
            
            console.log(`✅ Modal toggle successful: ${taskId}`);
            
            // Update the task in memory and refresh any visible task cards
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                // Update any visible task card too
                const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
                if (taskCard) {
                    this.updateTaskCardCompletionUI(taskCard, newStatus);
                }
            }
            
            // Update routine counts
            await this.loadRoutines();
            this.updateTaskCounts();
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`🚫 Modal toggle aborted: ${taskId}`);
                return;
            }
            
            console.error(`❌ Modal toggle failed: ${taskId}`, error);
            
            // Revert modal UI
            if (this.editingTask && this.editingTask.id === taskId) {
                this.editingTask.status = oldStatus;
                this.updateEditModalCompletionUI(oldStatus);
            }
            
            // Revert task card if visible
            const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskCard) {
                const task = this.tasks.find(t => t.id === taskId);
                if (task) {
                    task.status = oldStatus;
                    this.updateTaskCardCompletionUI(taskCard, oldStatus);
                }
            }
            
            this.showError('Failed to update task - reverted changes');
            
        } finally {
            // Clean up pending state
            this.pendingToggles.delete(taskId);
            this.abortControllers.delete(taskId);
        }
    }

    async handleTaskArchive(taskId) {
        try {
            console.log(`📦 Archiving task ${taskId}`);
            
            await this.apiCall(`/api/tasks/${taskId}/archive`, {
                method: 'PUT'
            });
            
            // Refresh board to remove archived task and update routine counts
            await this.loadTasks();
            await this.loadRoutines(); // Refresh routine task counts
            this.renderBoard();
        } catch (error) {
            console.error('Failed to archive task:', error);
            this.showError('Failed to archive task');
        }
    }

    async handleTaskRestore(taskId) {
        try {
            console.log(`📤 Restoring task ${taskId}`);
            
            await this.apiCall(`/api/tasks/${taskId}/restore`, {
                method: 'PUT'
            });
            
            // Refresh archive view
            await this.loadArchivedTasks();
            this.renderArchivedTasks();
            this.updateArchiveCounts();
            
            // Refresh main board to show the restored task
            await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error('Failed to restore task:', error);
            this.showError('Failed to restore task');
        }
    }

    async handleRoutineRestore(routineId) {
        try {
            console.log(`📤 Restoring routine ${routineId}`);
            
            const response = await this.apiCall(`/api/routines/${routineId}/restore`, {
                method: 'PUT'
            });
            
            console.log('✅ Routine restore successful:', response);
            
            // Refresh archive view
            await Promise.all([
                this.loadArchivedTasks(),
                this.loadArchivedRoutines()
            ]);
            this.renderArchivedItems();
            this.updateArchiveCounts();
            
            // Refresh routines view if we're currently viewing it
            if (this.currentView === 'routines') {
                await this.loadRoutines();
                this.loadRoutinesView();
            }
            
            // Refresh main board to show restored routine tasks
            await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error('❌ Failed to restore routine:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Full error object:', error);
            this.showError(`Failed to restore routine: ${error.message}`);
        }
    }

    async loadArchivedTasks() {
        this.archivedTasks = await this.apiCall('/api/tasks/archived');
        console.log('📋 loadArchivedTasks() complete, received', this.archivedTasks.length, 'archived tasks');
    }

    async loadArchivedRoutines() {
        console.log('📡 loadArchivedRoutines() called, making API call...');
        this.archivedRoutines = await this.apiCall('/api/routines/archived');
        console.log('📋 loadArchivedRoutines() complete, received', this.archivedRoutines.length, 'archived routines');
        console.log('📋 Archived routines data:', this.archivedRoutines);
    }

    // Modal Management
    openAddTaskModal(defaultColumn = 'today', routineId = null) {
        const modal = document.getElementById('add-task-modal');
        const columnSelect = document.getElementById('task-column');
        const routineSelect = document.getElementById('task-routine');
        
        // Store the selected column for use when submitting
        this.selectedColumn = defaultColumn;
        columnSelect.value = defaultColumn;
        
        // Pre-select routine if provided
        if (routineId && routineSelect) {
            routineSelect.value = routineId;
        }
        
        // Clear any previous list items and add one empty field (but don't focus it)
        document.getElementById('list-items-container').innerHTML = '';
        const listInput = this.addListItemField();
        listInput.blur(); // Remove focus from the list item field
        
        // Reset date display
        const dueDateDisplay = document.getElementById('due-date-display');
        if (dueDateDisplay) {
            dueDateDisplay.textContent = 'Set date';
        }
        
        // Update modal title to show which column
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            // Determine current week column display name
            const now = new Date();
            const dayOfWeek = now.getDay();
            const isEndOfWeek = dayOfWeek === 4 || dayOfWeek === 5; // Thursday or Friday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Saturday or Sunday
            
            let thisWeekDisplayName;
            if (isWeekend) {
                thisWeekDisplayName = 'Next Week';
            } else if (isEndOfWeek) {
                thisWeekDisplayName = 'This Weekend';
            } else {
                thisWeekDisplayName = 'This Week';
            }
            
            const columnNames = {
                'today': 'Today',
                'tomorrow': 'Tomorrow', 
                'this_week': thisWeekDisplayName,
                'horizon': 'On the Horizon'
            };
            modalTitle.innerHTML = `Add Task - <strong>${columnNames[defaultColumn] || 'Today'}</strong>`;
        }
        
        // Reset routine picker to main view and clear selection
        this.resetRoutinePickerToMain('task');
        this.setRoutinePickerSelection('task', null);
        
        modal.classList.remove('hidden');
        document.getElementById('task-title').focus();
    }

    addListItemField(autoFocus = true) {
        const container = document.getElementById('list-items-container');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center space-x-2 list-item-row';
        
        const itemId = `list-item-${Date.now()}`;
        itemDiv.innerHTML = `
            <div class="drag-handle cursor-move text-gray-400 hover:text-gray-600 px-1" draggable="true" title="Drag to reorder">
                <i class="fas fa-grip-vertical text-xs"></i>
            </div>
            <input type="text" 
                   id="${itemId}"
                   class="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm list-item-input"
                   placeholder="Enter item...">
            <button type="button" 
                    onclick="this.parentElement.remove()"
                    class="text-red-500 hover:text-red-700">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(itemDiv);
        const input = document.getElementById(itemId);
        
        // Auto-expand: add new field when user starts typing (only once per field)
        let previousValue = '';
        const self = this; // Store reference to this for event handler
        input.addEventListener('input', () => {
            // Only trigger when going from empty to having content
            if (previousValue === '' && input.value.length > 0) {
                // Check if there's already an empty field after this one
                const allInputs = Array.from(container.querySelectorAll('.list-item-input'));
                const currentIndex = allInputs.indexOf(input);
                const hasEmptyAfter = allInputs.slice(currentIndex + 1).some(inp => inp.value.trim() === '');
                
                if (!hasEmptyAfter) {
                    self.addListItemField(false); // Add new empty field without auto-focus
                }
            }
            previousValue = input.value;
        });
        
        // Handle tab navigation and form submission
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                // Find or create next field
                let nextField = self.findNextListField(input);
                if (!nextField) {
                    self.addListItemField();
                    nextField = self.findNextListField(input);
                }
                if (nextField) {
                    nextField.focus();
                }
            }
        });
        
        // Add universal key handlers for form submission
        this.setupListItemKeyHandlers(input, 'add-task-form');
        
        // Initialize drag/drop on container if not already done
        this.initializeListSorting('list-items-container');
        
        if (autoFocus) {
            input.focus();
        }
        return input;
    }
    
    updateEditModalCompletionUI(status) {
        const completeBtn = document.getElementById('edit-task-complete-btn');
        const completeCheck = document.getElementById('edit-complete-check');
        const completeLabel = document.getElementById('edit-complete-label');
        
        if (status === 'completed') {
            completeBtn.classList.add('bg-green-500', 'border-green-500');
            completeBtn.classList.remove('border-gray-300');
            completeCheck.classList.remove('hidden');
            completeLabel.textContent = 'Completed';
        } else {
            completeBtn.classList.remove('bg-green-500', 'border-green-500');
            completeBtn.classList.add('border-gray-300');
            completeCheck.classList.add('hidden');
            completeLabel.textContent = 'Mark as completed';
        }
    }

    findNextEmptyListField(container) {
        const inputs = container.querySelectorAll('.list-item-input');
        return Array.from(inputs).find(input => input.value.trim() === '');
    }

    findNextListField(currentInput) {
        const container = currentInput.closest('#list-items-container') || currentInput.closest('#edit-list-items-container');
        const inputs = Array.from(container.querySelectorAll('.list-item-input'));
        const currentIndex = inputs.indexOf(currentInput);
        return inputs[currentIndex + 1] || null;
    }


    closeAddTaskModal() {
        const modal = document.getElementById('add-task-modal');
        modal.classList.add('hidden');
        
        // Reset form
        document.getElementById('add-task-form').reset();
    }

    openEditTaskModal(task) {
        const modal = document.getElementById('edit-task-modal');
        
        // Store the task being edited
        this.editingTask = task;
        
        // Populate form fields
        document.getElementById('edit-task-title').value = task.title || '';
        document.getElementById('edit-task-notes').value = task.notes || '';
        document.getElementById('edit-task-due-date').value = task.due_date || '';
        
        // Update completion checkbox
        const completeBtn = document.getElementById('edit-task-complete-btn');
        const completeCheck = document.getElementById('edit-complete-check');
        const completeLabel = document.getElementById('edit-complete-label');
        
        if (task.status === 'completed') {
            completeBtn.classList.add('bg-green-500', 'border-green-500');
            completeBtn.classList.remove('border-gray-300');
            completeCheck.classList.remove('hidden');
            completeLabel.textContent = 'Completed';
        } else {
            completeBtn.classList.remove('bg-green-500', 'border-green-500');
            completeBtn.classList.add('border-gray-300');
            completeCheck.classList.add('hidden');
            completeLabel.textContent = 'Mark as completed';
        }
        
        // Update modal title
        const modalTitle = document.getElementById('edit-modal-title');
        modalTitle.textContent = task.type === 'list' ? 'Edit List' : 'Edit Task';
        
        // Update due date display
        const dueDateDisplay = document.getElementById('edit-due-date-display');
        if (task.due_date) {
            // Handle different date formats from API
            let dateStr = task.due_date;
            if (dateStr.includes('T')) {
                // Extract just the date part if it's a full timestamp
                dateStr = dateStr.split('T')[0];
            }
            
            const [year, month, day] = dateStr.split('-');
            const date = new Date(year, month - 1, day);
            
            if (!isNaN(date.getTime())) {
                dueDateDisplay.textContent = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                });
                // Also set the input value to just the date part
                document.getElementById('edit-task-due-date').value = dateStr;
            } else {
                dueDateDisplay.textContent = 'Set date';
            }
        } else {
            dueDateDisplay.textContent = 'Set date';
        }
        
        // Load list items if it's a list
        this.loadEditListItems(task);
        
        // Initialize list sorting for edit modal AFTER items are loaded
        setTimeout(() => {
            this.initializeListSorting('edit-list-items-container');
        }, 10);
        
        // Reset routine picker to main view first, then set selection
        this.resetRoutinePickerToMain('edit-task');
        this.setRoutinePickerSelection('edit-task', task.routine_id);
        
        // Close any open menu from previous modal usage
        const menu = document.getElementById('edit-task-menu');
        if (menu) menu.classList.add('hidden');
        
        modal.classList.remove('hidden');
        document.getElementById('edit-task-title').focus();
    }

    closeEditTaskModal() {
        const modal = document.getElementById('edit-task-modal');
        modal.classList.add('hidden');
        
        // Reset form
        document.getElementById('edit-task-form').reset();
        document.getElementById('edit-list-items-container').innerHTML = '';
        this.editingTask = null;
    }

    async openArchiveModal() {
        const modal = document.getElementById('archive-modal');
        modal.classList.remove('hidden');
        
        // Load both archived tasks and routines
        await Promise.all([
            this.loadArchivedTasks(),
            this.loadArchivedRoutines()
        ]);
        
        // Initialize tabs and render content
        this.initializeArchiveTabs();
        this.renderArchivedItems();
        this.updateArchiveCounts();
    }

    closeArchiveModal() {
        const modal = document.getElementById('archive-modal');
        modal.classList.add('hidden');
    }

    initializeArchiveTabs() {
        // Add event listeners to archive tabs
        document.querySelectorAll('.archive-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.archiveView;
                this.switchArchiveTab(view);
            });
        });
        
        // Set default active tab (tasks)
        this.switchArchiveTab('tasks');
    }

    switchArchiveTab(view) {
        // Update tab active states
        document.querySelectorAll('.archive-tab').forEach(tab => {
            const isActive = tab.dataset.archiveView === view;
            if (isActive) {
                tab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                tab.classList.add('border-blue-500', 'text-blue-600');
                // Update count badge color for active tab
                const countBadge = tab.querySelector('span');
                if (countBadge) {
                    countBadge.classList.remove('bg-gray-100', 'text-gray-800');
                    countBadge.classList.add('bg-blue-100', 'text-blue-800');
                }
            } else {
                tab.classList.remove('border-blue-500', 'text-blue-600');
                tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                // Update count badge color for inactive tab
                const countBadge = tab.querySelector('span');
                if (countBadge) {
                    countBadge.classList.remove('bg-blue-100', 'text-blue-800');
                    countBadge.classList.add('bg-gray-100', 'text-gray-800');
                }
            }
        });

        // Show/hide tab content
        document.querySelectorAll('.archive-tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`archive-${view}-content`).classList.remove('hidden');
    }

    updateArchiveCounts() {
        // Update count badges
        const tasksCount = this.archivedTasks ? this.archivedTasks.length : 0;
        const routinesCount = this.archivedRoutines ? this.archivedRoutines.length : 0;
        
        document.getElementById('archive-tasks-count').textContent = tasksCount;
        document.getElementById('archive-routines-count').textContent = routinesCount;
        document.getElementById('archive-notes-count').textContent = 0; // TODO: Update when notes are implemented
    }

    renderArchivedItems() {
        this.renderArchivedRoutines();
        this.renderArchivedTasks();
    }

    renderArchivedRoutines() {
        const container = document.getElementById('archived-routines-container');
        
        if (!this.archivedRoutines || this.archivedRoutines.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No archived routines</p>';
            return;
        }

        container.innerHTML = '';
        
        // Sort by archived_at timestamp, most recent first
        const sortedRoutines = [...this.archivedRoutines].sort((a, b) => {
            const dateA = new Date(a.archived_at);
            const dateB = new Date(b.archived_at);
            return dateB - dateA; // Descending order (most recent first)
        });
        
        sortedRoutines.forEach(routine => {
            const routineElement = this.createArchivedRoutineCard(routine);
            container.appendChild(routineElement);
        });
    }

    renderArchivedTasks() {
        const container = document.getElementById('archived-tasks-container');
        
        if (!this.archivedTasks || this.archivedTasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No archived tasks</p>';
            return;
        }

        container.innerHTML = '';
        
        // Sort by archived_at timestamp, most recent first
        const sortedTasks = [...this.archivedTasks].sort((a, b) => {
            const dateA = new Date(a.archived_at);
            const dateB = new Date(b.archived_at);
            return dateB - dateA; // Descending order (most recent first)
        });
        
        sortedTasks.forEach(task => {
            const taskElement = this.createArchivedTaskCard(task);
            container.appendChild(taskElement);
        });
    }

    createArchivedRoutineCard(routine) {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded-lg p-3 border border-gray-200';
        
        const archivedDateTime = new Date(routine.archived_at).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        div.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-1">
                        <span class="text-lg">${routine.icon || '⭐'}</span>
                        <h3 class="text-sm font-medium text-gray-900">${this.escapeHtml(routine.title || routine.name)}</h3>
                    </div>
                    ${routine.description ? `<p class="text-xs text-gray-600 mb-2">${this.escapeHtml(routine.description)}</p>` : ''}
                    <div class="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Archived ${archivedDateTime}</span>
                        <span>•</span>
                        <span>${(parseInt(routine.pending_tasks || 0) + parseInt(routine.completed_tasks || 0))} tasks</span>
                        ${routine.achievable ? '<span>• Achievable</span>' : ''}
                    </div>
                </div>
                <button class="restore-routine-btn text-blue-600 hover:text-blue-800 transition-colors" data-routine-id="${routine.id}" title="Restore routine">
                    <i class="fas fa-undo text-sm"></i>
                </button>
            </div>
        `;
        
        // Add restore button handler
        const restoreBtn = div.querySelector('.restore-routine-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                this.handleRoutineRestore(routine.id);
            });
        }
        
        return div;
    }

    createArchivedTaskCard(task) {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded-lg p-3 border border-gray-200';
        
        const routineInfo = task.routine_id ? 
            this.routines.find(r => r.id === task.routine_id) : null;
            
        const dueDate = task.due_date ? 
            new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
            
        const archivedDateTime = new Date(task.archived_at).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        div.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                    <h3 class="text-sm font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}">${this.escapeHtml(task.title)}</h3>
                    <div class="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                        <span>Archived ${archivedDateTime}</span>
                        <span>•</span>
                        <span class="capitalize">${task.status}</span>
                        ${task.column_name ? `<span>• ${task.column_name.replace('_', ' ')}</span>` : ''}
                        ${dueDate ? `<span>• Due ${dueDate}</span>` : ''}
                    </div>
                </div>
                <button class="restore-task-btn text-blue-600 hover:text-blue-800 transition-colors" data-task-id="${task.id}" title="Restore task">
                    <i class="fas fa-undo text-sm"></i>
                </button>
            </div>
            
            ${task.type === 'list' && task.items && task.items.length > 0 ? this.renderArchivedListItems(task.items) : ''}
            
            ${this.renderRoutineTag(routineInfo)}
        `;
        
        // Add restore button handler
        const restoreBtn = div.querySelector('.restore-task-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                this.handleTaskRestore(task.id);
            });
        }
        
        return div;
    }

    renderArchivedListItems(items) {
        if (!items || items.length === 0) return '';
        
        const itemsHtml = items.map(item => `
            <div class="flex items-center space-x-2">
                <i class="fas fa-${item.completed ? 'check-square text-green-600' : 'square text-gray-400'} text-xs"></i>
                <span class="text-xs ${item.completed ? 'text-gray-500 line-through' : 'text-gray-700'}">${this.escapeHtml(item.title)}</span>
            </div>
        `).join('');
        
        return `<div class="mt-2 space-y-1">${itemsHtml}</div>`;
    }

    loadEditListItems(task) {
        const container = document.getElementById('edit-list-items-container');
        container.innerHTML = '';
        
        if (task.items && task.items.length > 0) {
            // Sort items by position, falling back to id for stable ordering
            const sortedItems = [...task.items].sort((a, b) => {
                const positionA = a.position !== undefined ? a.position : 999999;
                const positionB = b.position !== undefined ? b.position : 999999;
                if (positionA === positionB) {
                    return a.id - b.id; // Fallback to id for stable ordering
                }
                return positionA - positionB;
            });
            
            sortedItems.forEach(item => {
                this.addEditListItemField(item);
            });
        }
        
        // Always add an empty field at the bottom for new items
        this.addEditListItemField(null, false); // Don't auto-focus the empty field
    }

    addEditListItemField(existingItem = null, autoFocus = true) {
        const container = document.getElementById('edit-list-items-container');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center space-x-2 list-item-row';
        
        const itemId = existingItem ? existingItem.id : `new-item-${Date.now()}`;
        const isCompleted = existingItem ? existingItem.completed : false;
        const itemTitle = existingItem ? existingItem.title : '';
        
        itemDiv.innerHTML = `
            <div class="drag-handle cursor-move text-gray-400 hover:text-gray-600 px-1" draggable="true" title="Drag to reorder">
                <i class="fas fa-grip-vertical text-xs"></i>
            </div>
            <input type="checkbox" ${isCompleted ? 'checked' : ''} 
                   class="w-4 h-4 text-green-600"
                   data-item-id="${itemId}"
                   ${existingItem ? 'onchange="app.handleEditItemToggle(event)"' : ''}>
            <input type="text" 
                   value="${this.escapeHtml(itemTitle)}"
                   data-item-id="${itemId}"
                   class="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm list-item-input"
                   placeholder="Enter item...">
            <button type="button" 
                    onclick="this.parentElement.remove()"
                    class="text-red-500 hover:text-red-700">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(itemDiv);
        const input = itemDiv.querySelector('input[type="text"]');
        
        // Only add auto-expand behavior for new items (not existing ones)
        if (!existingItem) {
            // Auto-expand: add new field when user starts typing (only once per field)
            let previousValue = '';
            const self = this; // Store reference to this for event handler
            input.addEventListener('input', () => {
                // Only trigger when going from empty to having content
                if (previousValue === '' && input.value.length > 0) {
                    // Check if there's already an empty field after this one
                    const allInputs = Array.from(container.querySelectorAll('.list-item-input'));
                    const currentIndex = allInputs.indexOf(input);
                    const hasEmptyAfter = allInputs.slice(currentIndex + 1).some(inp => inp.value.trim() === '');
                    
                    if (!hasEmptyAfter) {
                        self.addEditListItemField(null, false); // Add new empty field without auto-focus
                    }
                }
                previousValue = input.value;
            });
            
            // Handle tab navigation and form submission
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    // Find or create next field
                    let nextField = self.findNextListField(input);
                    if (!nextField) {
                        self.addEditListItemField();
                        nextField = self.findNextListField(input);
                    }
                    if (nextField) {
                        nextField.focus();
                    }
                }
            });
            
            if (autoFocus) {
                input.focus();
            }
        }
        
        // Add universal key handlers for form submission (for ALL items)
        this.setupListItemKeyHandlers(input, 'edit-task-form');
        
        // Initialize drag/drop on container if not already done
        this.initializeListSorting('edit-list-items-container');
        
        return input;
    }


    async handleEditTask(event) {
        event.preventDefault();
        
        if (!this.editingTask) return;
        
        const taskData = {
            title: document.getElementById('edit-task-title').value,
            notes: document.getElementById('edit-task-notes').value,
            due_date: document.getElementById('edit-task-due-date').value || null,
            routine_id: document.getElementById('edit-task-routine').value || null
        };
        
        try {
            this.showLoading();
            
            // Update the task
            await this.apiCall(`/api/tasks/${this.editingTask.id}`, {
                method: 'PUT',
                body: JSON.stringify(taskData)
            });
            
            // Handle list items if this is or becomes a list
            const itemInputs = document.querySelectorAll('#edit-list-items-container input[type="text"]');
            const existingItems = this.editingTask.items || [];
            
            // Update existing items and add new ones
            for (const input of itemInputs) {
                const itemId = input.dataset.itemId;
                const itemTitle = input.value.trim();
                const position = parseInt(input.dataset.order) || 0;
                const checkbox = input.parentElement.querySelector('input[type="checkbox"]');
                const isCompleted = checkbox.checked;
                
                if (itemTitle) {
                    if (itemId.startsWith('new-item-')) {
                        // Add new item
                        await this.apiCall(`/api/tasks/${this.editingTask.id}/items`, {
                            method: 'POST',
                            body: JSON.stringify({ 
                                title: itemTitle,
                                position: position
                            })
                        });
                    } else {
                        // Update existing item
                        await this.apiCall(`/api/tasks/${this.editingTask.id}/items/${itemId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ 
                                title: itemTitle,
                                completed: isCompleted,
                                position: position
                            })
                        });
                    }
                }
            }
            
            // Remove deleted items (items that were in original but not in current inputs)
            const currentItemIds = Array.from(itemInputs)
                .map(input => input.dataset.itemId)
                .filter(id => !id.startsWith('new-item-'));
            
            for (const existingItem of existingItems) {
                // Convert both to strings for comparison since dataset values are strings
                if (!currentItemIds.includes(String(existingItem.id))) {
                    await this.apiCall(`/api/tasks/${this.editingTask.id}/items/${existingItem.id}`, {
                        method: 'DELETE'
                    });
                }
            }
            
            // Reload tasks and routines to get updated data
            await this.loadTasks();
            await this.loadRoutines(); // Refresh routine task counts
            this.renderBoard();
            this.closeEditTaskModal();
            
        } catch (error) {
            console.error('Failed to update task:', error);
            console.error('Error stack:', error.stack);
            this.showError('Failed to update task');
        } finally {
            this.hideLoading();
        }
    }

    async handleAddTask(event) {
        event.preventDefault();
        
        // Collect list items if any
        const listItems = [];
        const itemInputs = document.querySelectorAll('#list-items-container input[type="text"]');
        itemInputs.forEach(input => {
            if (input.value.trim()) {
                listItems.push(input.value.trim());
            }
        });
        
        const taskData = {
            title: document.getElementById('task-title').value,
            notes: document.getElementById('task-notes').value,
            column_name: document.getElementById('task-column').value,
            due_date: document.getElementById('task-due-date').value || null,
            routine_id: document.getElementById('task-routine').value || null
        };
        
        try {
            this.showLoading();
            
            // Create the task first
            const newTask = await this.createTask(taskData);
            
            // If there are list items, add them to convert it to a list
            if (listItems.length > 0 && newTask && newTask.id) {
                for (const itemTitle of listItems) {
                    await this.apiCall(`/api/tasks/${newTask.id}/items`, {
                        method: 'POST',
                        body: JSON.stringify({ title: itemTitle })
                    });
                }
                // Reload tasks to get the updated list
                await this.loadTasks();
            }
            
            // Refresh routines to update task counts
            await this.loadRoutines();
            this.renderBoard();
            this.closeAddTaskModal();
        } catch (error) {
            console.error('Failed to create task:', error);
            this.showError('Failed to create task');
        } finally {
            this.hideLoading();
        }
    }

    // Drag and Drop
    initializeDragAndDrop() {
        console.log('🔄 Initializing drag-and-drop...');
        
        const columns = ['today', 'tomorrow', 'this_week', 'horizon'];
        
        columns.forEach(column => {
            const container = document.getElementById(`${this.getColumnId(column)}-tasks`);
            if (!container) return;
            
            const sortable = Sortable.create(container, {
                group: 'tasks',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.add-task-ghost-card',  // Can't drag the ghost card
                onChange: (evt) => {
                    // Keep ghost card at the bottom during drag
                    const ghostCard = evt.to.querySelector('.add-task-ghost-card');
                    if (ghostCard && ghostCard.parentElement === evt.to) {
                        evt.to.appendChild(ghostCard);
                    }
                },
                onEnd: (evt) => {
                    // Ensure ghost card is at the bottom after drop
                    const ghostCard = evt.to.querySelector('.add-task-ghost-card');
                    if (ghostCard) {
                        evt.to.appendChild(ghostCard);
                    }
                    
                    this.handleDragEnd(evt);
                }
            });
            
            this.sortables[column] = sortable;
        });
        
        console.log('✅ Drag-and-drop initialized');
    }

    async handleDragEnd(evt) {
        const taskId = evt.item.getAttribute('data-task-id');
        const newColumn = evt.to.closest('[data-column]').getAttribute('data-column');
        
        if (!taskId || !newColumn) return;
        
        // Calculate the actual position (DOM index might include ghost card)
        // Get all task cards in the new column (excluding ghost card)
        const columnContainer = evt.to;
        const allCards = Array.from(columnContainer.querySelectorAll('.task-card'));
        const taskIndex = allCards.findIndex(card => card.getAttribute('data-task-id') === taskId);
        const newPosition = taskIndex >= 0 ? taskIndex : 0;
        
        console.log(`📍 Task moved to position ${newPosition} in ${newColumn} column`);
        
        try {
            await this.moveTask(taskId, newColumn, newPosition);
            this.updateTaskCounts();
        } catch (error) {
            console.error('Failed to move task:', error);
            // Reload board to revert changes
            await this.loadTasks();
            this.renderBoard();
        }
    }

    // Global functions for onclick handlers
    addTaskToColumn(column) {
        this.openAddTaskModal(column);
    }

    // Utility Methods
    // View Management
    switchView(view) {
        console.log(`Switching to ${view} view`);
        
        // Hide all views
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('hidden');
        });
        
        // Update tab active states
        document.querySelectorAll('.nav-tab').forEach(tab => {
            if (tab.dataset.view === view) {
                tab.classList.add('text-blue-600', 'bg-blue-50');
                tab.classList.remove('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            } else {
                tab.classList.remove('text-blue-600', 'bg-blue-50');
                tab.classList.add('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            }
        });
        
        // Hide breadcrumb by default
        document.getElementById('breadcrumb').classList.add('hidden');
        
        // Show the selected view
        switch(view) {
            case 'tasks':
                document.getElementById('tasks-view').classList.remove('hidden');
                this.currentView = 'tasks';
                break;
            case 'routines':
                document.getElementById('routines-view').classList.remove('hidden');
                this.currentView = 'routines';
                this.loadRoutinesView();
                break;
            case 'notes':
                document.getElementById('notes-view').classList.remove('hidden');
                this.currentView = 'notes';
                // TODO: Load notes
                break;
        }
    }
    
    // Routine Management
    async loadRoutinesView() {
        console.log('Loading routines view');
        const container = document.getElementById('routines-grid');
        
        // Clear all cards
        container.innerHTML = '';
        
        // Create a container specifically for sortable routine cards
        const sortableContainer = document.createElement('div');
        sortableContainer.id = 'sortable-routines';
        sortableContainer.className = 'contents'; // CSS grid passthrough
        
        // Sort routines by display_order if available, otherwise by creation date (oldest first)
        const sortedRoutines = [...this.routines].sort((a, b) => {
            // If both have display_order, sort by that
            if (a.display_order !== null && b.display_order !== null) {
                return a.display_order - b.display_order;
            }
            // If only one has display_order, it comes first
            if (a.display_order !== null) return -1;
            if (b.display_order !== null) return 1;
            // Otherwise sort by creation date (oldest first)
            return new Date(a.created_at) - new Date(b.created_at);
        });
        
        // Add routine cards to the sortable container
        sortedRoutines.forEach(routine => {
            const card = this.createRoutineCard(routine);
            sortableContainer.appendChild(card);
        });
        
        // Add the sortable container to the main grid
        container.appendChild(sortableContainer);
        
        // Add "Add New Routine" card at the end (outside sortable area)
        const addCard = document.createElement('div');
        addCard.id = 'add-routine-card';
        addCard.className = 'bg-transparent border-2 border-dashed border-white border-opacity-60 rounded-lg p-4 hover:border-gray-300 hover:bg-gray-200 hover:bg-opacity-20 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-white text-opacity-80 hover:text-gray-300 min-h-[140px]';
        addCard.innerHTML = `
            <i class="fas fa-plus text-3xl mb-2"></i>
            <span class="text-sm font-medium">Add New Routine</span>
        `;
        
        // Add click handler for the add card
        addCard.addEventListener('click', () => {
            this.openRoutineModal();
        });
        
        container.appendChild(addCard);
        
        // Initialize drag-and-drop for routine cards only
        this.initializeRoutineDragAndDrop();
    }
    
    initializeRoutineDragAndDrop() {
        const sortableContainer = document.getElementById('sortable-routines');
        if (!sortableContainer) return;
        
        // Destroy existing sortable if it exists
        if (this.routineSortable) {
            this.routineSortable.destroy();
        }
        
        this.routineSortable = Sortable.create(sortableContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: (evt) => this.handleRoutineReorder(evt)
        });
    }
    
    async handleRoutineReorder(evt) {
        // Get current order of routine cards from the sortable container only
        const sortableContainer = document.getElementById('sortable-routines');
        const routineCards = sortableContainer.querySelectorAll('.routine-card');
        const newOrder = [];
        
        routineCards.forEach((card, index) => {
            const routineId = card.getAttribute('data-routine-id');
            if (routineId) {
                newOrder.push({ id: routineId, order: index });
            }
        });
        
        try {
            // Update the order in the backend
            await this.apiCall('/api/routines/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrder })
            });
            
            // Update local routines array to match new order
            await this.loadRoutines();
        } catch (error) {
            console.error('Failed to reorder routines:', error);
            // Reload the view to revert the change
            this.loadRoutinesView();
        }
    }
    
    createRoutineCard(routine) {
        const div = document.createElement('div');
        const isPaused = routine.status === 'paused';
        const isCompleted = routine.status === 'completed';
        
        // Determine card styling based on status
        let cardClasses = 'routine-card rounded-lg p-4 shadow transition-all duration-200 cursor-pointer border-2';
        
        if (isCompleted) {
            // Celebratory styling for completed routines
            cardClasses += ' bg-gradient-to-br from-green-50 to-blue-50 border-green-300 hover:border-green-400 hover:shadow-lg';
        } else if (isPaused) {
            // Muted styling for paused routines
            cardClasses += ' bg-gray-50 opacity-75 border-transparent hover:border-blue-400 hover:shadow-lg';
        } else {
            // Normal styling for active routines
            cardClasses += ' bg-white border-transparent hover:border-blue-400 hover:shadow-lg';
        }
        
        div.className = cardClasses;
        div.setAttribute('data-routine-id', routine.id);
        
        const colorMap = {
            blue: 'bg-blue-100 text-blue-700',
            green: 'bg-green-200 text-green-800',  // Darker green - looks good!
            purple: 'bg-purple-100 text-purple-700',
            orange: 'bg-orange-100 text-orange-700',
            red: 'bg-red-100 text-red-700',
            yellow: 'bg-yellow-100 text-yellow-700',
            pink: 'bg-pink-100 text-pink-700',
            gray: 'bg-gray-100 text-gray-700',
            brown: 'bg-amber-400 text-amber-900',  // Richer, darker brown
            teal: 'bg-teal-100 text-teal-700',
            lime: 'bg-lime-50 text-lime-700',  // Lighter lime - looks good!
            black: 'bg-gray-600 text-white'  // Muted black - dark gray with white text
        };
        
        // Map hex colors to names
        const hexToColorName = {
            '#3498db': 'blue',
            '#2ecc71': 'green',
            '#9b59b6': 'purple',
            '#e67e22': 'orange',
            '#e74c3c': 'red',
            '#f39c12': 'yellow',
            '#e91e63': 'pink',
            '#95a5a6': 'gray'
        };
        
        // Handle color - could be hex or name
        let colorName = routine.color;
        if (routine.color && routine.color.startsWith('#')) {
            colorName = hexToColorName[routine.color] || 'blue';
        }
        // Handle custom brown color for routine cards
        let colorClass;
        if (colorName === 'brown') {
            colorClass = 'custom-brown-card';  // We'll handle this with inline styles
        } else {
            colorClass = colorMap[colorName] || colorMap.blue;
        }
        
        // Use the emoji directly (no mapping needed)
        const icon = routine.icon || '⭐';
        
        div.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center space-x-2">
                    <span class="text-2xl">${routine.icon || icon}</span>
                    <h3 class="text-lg font-semibold">${this.escapeHtml(routine.title || routine.name)}</h3>
                </div>
                <div class="relative">
                    <button class="routine-menu-btn text-gray-400 hover:text-gray-600 p-1" data-routine-id="${routine.id}">
                        <i class="fas fa-ellipsis-h text-sm"></i>
                    </button>
                    <div class="routine-menu absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[150px] hidden">
                        ${routine.status !== 'paused' ? 
                            `<button class="pause-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                                <i class="fas fa-pause text-xs mr-2"></i>Pause
                            </button>` :
                            `<button class="resume-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                                <i class="fas fa-play text-xs mr-2"></i>Resume
                            </button>`
                        }
                        ${routine.achievable && routine.status !== 'completed' ? 
                            `<button class="complete-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                                <i class="fas fa-check text-xs mr-2"></i>Complete
                            </button>` : ''
                        }
                        <div class="border-t border-gray-200"></div>
                        <button class="archive-routine-btn w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50" data-routine-id="${routine.id}">
                            <i class="fas fa-archive text-xs mr-2"></i>Archive
                        </button>
                    </div>
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-3 truncate min-h-[1.25rem]">${routine.description ? this.escapeHtml(routine.description) : ''}</p>
            <div class="relative flex items-center justify-between">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass === 'custom-brown-card' ? '' : colorClass}" ${colorClass === 'custom-brown-card' ? 'style="background-color: #e8d8cf; color: #73513b;"' : ''}>
                    ${(parseInt(routine.pending_tasks || 0) + parseInt(routine.completed_tasks || 0))} Active${parseInt(routine.archived_tasks || 0) > 0 ? `<span class="text-[10px] opacity-75 ml-0.5"> / ${routine.archived_tasks} Archived</span>` : ''}
                </span>
                ${routine.achievable ? '<div class="absolute left-1/2 transform -translate-x-1/2"><span class="text-xs text-gray-500">Achievable</span></div>' : ''}
                <div class="text-right">
                    ${routine.status === 'paused' ? '<span class="text-xs text-gray-500">▐▐ <strong> PAUSED</strong></span>' : ''}
                    ${routine.status === 'completed' ? '<span class="text-xs text-green-600 font-medium">🎉 <strong>COMPLETED</strong></span>' : ''}
                </div>
            </div>
        `;
        
        // Add click handler to open comprehensive modal
        div.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                this.openRoutineModal(routine);
            }
        });
        
        // Add menu button handler
        const menuBtn = div.querySelector('.routine-menu-btn');
        const menu = div.querySelector('.routine-menu');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Close other menus
                document.querySelectorAll('.routine-menu').forEach(m => {
                    if (m !== menu) m.classList.add('hidden');
                });
                
                // Toggle this menu
                menu.classList.toggle('hidden');
            });
        }
        
        // Add menu action handlers
        const pauseBtn = div.querySelector('.pause-routine-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.pauseRoutine(routine.id);
                menu.classList.add('hidden');
            });
        }
        
        const resumeBtn = div.querySelector('.resume-routine-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.resumeRoutine(routine.id);
                menu.classList.add('hidden');
            });
        }
        
        const completeBtn = div.querySelector('.complete-routine-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.completeRoutine(routine.id);
                menu.classList.add('hidden');
            });
        }
        
        const archiveBtn = div.querySelector('.archive-routine-btn');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.archiveRoutine(routine.id);
                menu.classList.add('hidden');
            });
        }
        
        
        return div;
    }
    
    
    async openRoutineModal(routine = null) {
        const modal = document.getElementById('routine-modal');
        const modalTitle = document.getElementById('routine-modal-title');
        const itemsSection = document.getElementById('routine-items-section');
        
        if (routine) {
            modalTitle.textContent = `Routine: ${routine.title || routine.name}`;
            // Map API fields to form fields
            document.getElementById('routine-name').value = routine.title || routine.name || '';
            document.getElementById('routine-description').value = routine.description || '';
            
            // Handle color - convert hex to name if needed
            let colorValue = 'blue';
            if (routine.color) {
                const colorHexMap = {
                    '#3498db': 'blue',
                    '#2ecc71': 'green',
                    '#9b59b6': 'purple',
                    '#e67e22': 'orange',
                    '#e74c3c': 'red',
                    '#f39c12': 'yellow',
                    '#e91e63': 'pink',
                    '#95a5a6': 'gray'
                };
                colorValue = colorHexMap[routine.color] || routine.color;
                // If it's already a color name, use it directly
                if (['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink', 'gray', 'brown', 'teal', 'lime', 'black'].includes(routine.color)) {
                    colorValue = routine.color;
                }
            }
            document.getElementById('routine-color').value = colorValue;
            
            // Update color swatch selection
            this.updateColorSwatchSelection(colorValue);
            
            // Set the emoji directly
            document.getElementById('routine-icon').value = routine.icon || '⭐';
            
            document.getElementById('routine-achievable').checked = routine.achievable || false;
            
            // Set completion state and visibility
            const isCompleted = routine.status === 'completed';
            const completedContainer = document.getElementById('routine-completed-container');
            const completedCheckbox = document.getElementById('routine-completed');
            
            if (routine.achievable) {
                // Show completed checkbox if routine is achievable
                completedContainer.classList.remove('hidden');
                completedCheckbox.checked = isCompleted;
            } else {
                // Hide completed checkbox if not achievable
                completedContainer.classList.add('hidden');
                completedCheckbox.checked = false;
            }
            
            // Set pause state - check if routine status is paused
            const isPausedStatus = routine.status === 'paused';
            const pauseToggleBtn = document.getElementById('pause-toggle-btn');
            const pauseUntilContainer = document.getElementById('pause-until-container');
            const pauseUntilDate = document.getElementById('pause-until-date');
            const routinePausedInput = document.getElementById('routine-paused');
            const routinePauseUntilInput = document.getElementById('routine-pause-until');
            
            if (isPausedStatus) {
                pauseToggleBtn.textContent = '⏸️ Paused';
                pauseToggleBtn.className = 'px-5 py-3 border border-gray-300 rounded-md text-sm font-medium transition-colors bg-orange-50 text-orange-700 hover:bg-orange-100';
                pauseUntilContainer.classList.remove('hidden');
                routinePausedInput.value = 'true';
                
                // Handle both date strings and null (indefinite pause)
                if (routine.pause_until === null) {
                    pauseUntilDate.value = '';
                    routinePauseUntilInput.value = '';
                } else {
                    pauseUntilDate.value = routine.pause_until.split('T')[0]; // Convert to date format
                    routinePauseUntilInput.value = routine.pause_until.split('T')[0];
                }
            } else {
                pauseToggleBtn.textContent = '▶️ Active';
                pauseToggleBtn.className = 'px-5 py-3 border border-gray-300 rounded-md text-sm font-medium transition-colors bg-green-50 text-green-700 hover:bg-green-100';
                pauseUntilContainer.classList.add('hidden');
                routinePausedInput.value = 'false';
                routinePauseUntilInput.value = '';
            }
            
            // Override status controls if routine is completed
            if (isCompleted) {
                this.setStatusControlsEnabled(false);
            } else {
                this.setStatusControlsEnabled(true);
            }
            
            this.editingRoutine = routine;
            
            // Show tasks and notes section
            itemsSection.classList.remove('hidden');
            
            // Load tasks and notes for this routine
            await this.loadRoutineItems(routine);
            
        } else {
            modalTitle.textContent = 'Create New Routine';
            document.getElementById('routine-form').reset();
            this.editingRoutine = null;
            
            // Set default color selection
            document.getElementById('routine-color').value = 'blue';
            this.updateColorSwatchSelection('blue');
            
            // Reset pause state to active
            const pauseToggleBtn = document.getElementById('pause-toggle-btn');
            const pauseUntilContainer = document.getElementById('pause-until-container');
            const routinePausedInput = document.getElementById('routine-paused');
            const routinePauseUntilInput = document.getElementById('routine-pause-until');
            
            pauseToggleBtn.textContent = '▶️ Active';
            pauseToggleBtn.className = 'px-5 py-3 border border-gray-300 rounded-md text-sm font-medium transition-colors bg-green-50 text-green-700 hover:bg-green-100';
            pauseUntilContainer.classList.add('hidden');
            routinePausedInput.value = 'false';
            routinePauseUntilInput.value = '';
            
            // Hide tasks and notes section
            itemsSection.classList.add('hidden');
        }
        
        modal.classList.remove('hidden');
    }
    
    async loadRoutineItems(routine) {
        try {
            // Store current routine for ghost cards
            this.currentRoutine = routine;
            
            // Load tasks for this routine
            const tasks = await this.apiCall(`/api/routines/${routine.id}/tasks`);
            this.renderRoutineTasks(tasks);
            
            // TODO: Load notes for this routine when notes API is ready
            // const notes = await this.apiCall(`/api/routines/${routine.id}/notes`);
            // this.renderRoutineNotes(notes);
            
            // For now, show placeholder for notes
            this.renderRoutineNotes([]);
            
        } catch (error) {
            console.error('Failed to load routine items:', error);
        }
    }
    
    renderRoutineTasks(tasks) {
        const container = document.getElementById('routine-tasks-list');
        const countElement = document.getElementById('routine-tasks-count');
        
        // Filter out archived tasks
        const activeTasks = tasks.filter(task => !task.is_archived);
        const archivedCount = tasks.length - activeTasks.length;
        
        countElement.textContent = `${activeTasks.length} tasks`;
        
        container.innerHTML = '';
        
        if (activeTasks.length === 0) {
            const noTasksMsg = document.createElement('p');
            noTasksMsg.className = 'text-gray-500 text-sm mb-3';
            noTasksMsg.textContent = 'No tasks found for this routine.';
            container.appendChild(noTasksMsg);
        } else {
            activeTasks.forEach(task => {
                const div = document.createElement('div');
                div.className = 'bg-white rounded-lg p-3 border border-gray-200 hover:shadow-sm hover:border-blue-400 hover:border-2 transition-all cursor-pointer';
                div.setAttribute('data-task-id', task.id);
                
                const dueDate = task.due_date ? 
                    new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                
                div.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                                   class="task-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                   data-task-id="${task.id}">
                            <span class="text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''} cursor-pointer task-title">${this.escapeHtml(task.title)}</span>
                            <span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">${task.column_name || task.column}</span>
                        </div>
                        <div class="flex items-center space-x-2 text-xs text-gray-500">
                            ${dueDate ? `<span><i class="fas fa-calendar mr-1"></i>${dueDate}</span>` : ''}
                            ${task.type === 'list' ? '<span><i class="fas fa-list mr-1"></i>List</span>' : ''}
                        </div>
                    </div>
                `;
                
                // Add checkbox handler for task completion with confetti!
                const checkbox = div.querySelector('.task-checkbox');
                checkbox.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    const newStatus = e.target.checked ? 'completed' : 'pending';
                    const oldStatus = task.status;
                    
                    // Update task status optimistically
                    task.status = newStatus;
                    
                    // Update UI optimistically
                    const taskTitle = div.querySelector('.task-title');
                    if (newStatus === 'completed') {
                        taskTitle.classList.add('line-through', 'text-gray-500');
                        taskTitle.classList.remove('text-gray-700');
                        // Trigger confetti for completion
                        this.triggerTaskCompletionConfetti(checkbox);
                    } else {
                        taskTitle.classList.remove('line-through', 'text-gray-500');
                        taskTitle.classList.add('text-gray-700');
                    }
                    
                    // Make API call
                    try {
                        await this.apiCall(`/api/tasks/${task.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ status: newStatus })
                        });
                        
                        // Update routine counts without full re-render
                        await this.loadRoutines();
                        this.updateTaskCounts();
                        
                    } catch (error) {
                        console.error('Failed to toggle task completion:', error);
                        
                        // Revert optimistic changes
                        task.status = oldStatus;
                        checkbox.checked = oldStatus === 'completed';
                        
                        if (oldStatus === 'completed') {
                            taskTitle.classList.add('line-through', 'text-gray-500');
                            taskTitle.classList.remove('text-gray-700');
                        } else {
                            taskTitle.classList.remove('line-through', 'text-gray-500');
                            taskTitle.classList.add('text-gray-700');
                        }
                        
                        this.showError('Failed to update task - reverted changes');
                    }
                });
                
                // Add click handler to task title to open edit modal
                const taskTitle = div.querySelector('.task-title');
                taskTitle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openEditTaskModal(task);
                });
                
                container.appendChild(div);
            });
        }
        
        // Add 4 mini ghost cards at the bottom for creating tasks in each column
        const ghostCardsContainer = document.createElement('div');
        ghostCardsContainer.className = 'mt-3 flex gap-1';
        
        const columns = [
            { name: 'today', label: 'Today' },
            { name: 'tomorrow', label: 'Tomorrow' },
            { name: 'this_week', label: 'This Week' },
            { name: 'horizon', label: 'Horizon' }
        ];
        
        columns.forEach(column => {
            const ghostCard = document.createElement('button');
            ghostCard.className = 'flex-1 bg-transparent border border-dashed border-gray-300 border-opacity-50 rounded px-2 py-1 hover:border-opacity-100 hover:border-blue-400 hover:bg-blue-50 hover:bg-opacity-60 transition-all duration-200 cursor-pointer text-gray-400 hover:text-blue-500 text-xs';
            
            ghostCard.innerHTML = `+ ${column.label}`;
            
            // Add click handler to open add task modal with this column and current routine pre-selected
            ghostCard.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openAddTaskModal(column.name, this.currentRoutine?.id);
            });
            
            ghostCardsContainer.appendChild(ghostCard);
        });
        
        container.appendChild(ghostCardsContainer);
        
        // Add archived task count if there are archived tasks
        if (archivedCount > 0) {
            const archivedCountElement = document.createElement('div');
            archivedCountElement.className = 'mt-3 pt-2 border-t border-gray-200 text-center text-xs text-gray-400';
            archivedCountElement.textContent = `${archivedCount} Archived Task${archivedCount === 1 ? '' : 's'}`;
            container.appendChild(archivedCountElement);
        }
    }
    
    renderRoutineNotes(notes) {
        const container = document.getElementById('routine-notes-list');
        const countElement = document.getElementById('routine-notes-count');
        
        countElement.textContent = `${notes.length} notes`;
        
        if (notes.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No notes found for this routine.</p>';
            return;
        }
        
        container.innerHTML = '';
        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'bg-white rounded-lg p-3 border border-gray-200 hover:shadow-sm transition-shadow';
            
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="text-sm">📝</span>
                        <span class="text-sm font-medium">${this.escapeHtml(note.title)}</span>
                    </div>
                    <div class="text-xs text-gray-500">
                        <span>Column ${note.column}</span>
                    </div>
                </div>
                ${note.content ? `<p class="text-xs text-gray-600 mt-1 line-clamp-2">${this.escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</p>` : ''}
            `;
            
            container.appendChild(div);
        });
    }
    
    openEmojiPicker() {
        // Create a simple emoji palette
        const commonEmojis = [
            '⭐', '❤️', '🔥', '🚀', '📚', '💪', '💻', '🎨', '🎵', '🏠',
            '🔧', '🏗️', '📝', '🐸', '💃', '🏂', '💑', '🫠', '⛱️', '🛠️',
            '✅', '📋', '🎯', '⚡', '🌟', '🎪', '🎮', '🍕', '☕', '🌱',
            '🔬', '🎭', '🏆', '🎸', '📸', '🎬', '🗺️', '🚴', '🧘', '🎨'
        ];
        
        // Create popup
        const popup = document.createElement('div');
        popup.className = 'fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-[100]';
        popup.innerHTML = `
            <div class="bg-white rounded-lg p-4 max-w-md mx-4 shadow-lg">
                <h3 class="text-md font-semibold mb-3">Choose an Emoji</h3>
                <div class="grid grid-cols-10 gap-1 mb-4">
                    ${commonEmojis.map(emoji => `
                        <button type="button" class="emoji-option p-2 text-lg hover:bg-gray-100 rounded transition-colors" data-emoji="${emoji}">
                            ${emoji}
                        </button>
                    `).join('')}
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-xs text-gray-500">Or type any emoji in the field above</p>
                    <button type="button" class="close-emoji-picker px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Add event listeners
        popup.querySelectorAll('.emoji-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('routine-icon').value = btn.dataset.emoji;
                document.body.removeChild(popup);
            });
        });
        
        popup.querySelector('.close-emoji-picker').addEventListener('click', () => {
            document.body.removeChild(popup);
        });
        
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                document.body.removeChild(popup);
            }
        });
    }
    
    updateColorSwatchSelection(colorName) {
        // Reset all swatches
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.remove('border-gray-800', 'ring-2', 'ring-gray-400');
            swatch.classList.add('border-gray-300');
        });
        
        // Select the correct swatch
        const selectedSwatch = document.querySelector(`[data-color="${colorName}"]`);
        if (selectedSwatch) {
            selectedSwatch.classList.remove('border-gray-300');
            selectedSwatch.classList.add('border-gray-800', 'ring-2', 'ring-gray-400');
        }
    }
    
    closeRoutineModal() {
        document.getElementById('routine-modal').classList.add('hidden');
        this.editingRoutine = null;
    }
    
    async handleRoutineSubmit(event) {
        event.preventDefault();
        
        const isPaused = document.getElementById('routine-paused').value === 'true';
        const pauseUntil = document.getElementById('routine-pause-until').value;
        const isCompleted = document.getElementById('routine-completed').checked;
        
        const routineData = {
            title: document.getElementById('routine-name').value,  // API expects 'title' not 'name'
            description: document.getElementById('routine-description').value,
            color: document.getElementById('routine-color').value,
            icon: document.getElementById('routine-icon').value,
            achievable: document.getElementById('routine-achievable').checked,
            status: isCompleted ? 'completed' : (isPaused ? 'paused' : 'active'),
            pause_until: isPaused ? (pauseUntil || null) : null
        };
        
        try {
            if (this.editingRoutine) {
                // Update existing routine
                await this.apiCall(`/api/routines/${this.editingRoutine.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routineData)
                });
            } else {
                // Create new routine
                await this.apiCall('/api/routines', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routineData)
                });
            }
            
            // Reload routines
            await this.loadRoutines();
            this.loadRoutinesView();
            
            // Reload tasks to reflect pause status changes on task board
            await this.loadTasks();
            this.renderBoard();
            
            this.closeRoutineModal();
        } catch (error) {
            console.error('Failed to save routine:', error);
            this.showError('Failed to save routine');
        }
    }
    
    async pauseRoutine(routineId) {
        try {
            // For now, pause indefinitely. Could add date picker later
            await this.apiCall(`/api/routines/${routineId}/pause`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            await this.loadRoutines();
            this.loadRoutinesView();
            // Refresh task board to show updated routine status on task cards
            await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error('Failed to pause routine:', error);
            this.showError('Failed to pause routine');
        }
    }
    
    async resumeRoutine(routineId) {
        try {
            // Resume by setting status to 'active' using the general update endpoint
            await this.apiCall(`/api/routines/${routineId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active', pause_until: null })
            });
            await this.loadRoutines();
            this.loadRoutinesView();
            // Refresh task board to show updated routine status on task cards
            await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error('Failed to resume routine:', error);
            this.showError('Failed to resume routine');
        }
    }
    
    togglePauseState() {
        const pauseToggleBtn = document.getElementById('pause-toggle-btn');
        const pauseUntilContainer = document.getElementById('pause-until-container');
        const pauseUntilDate = document.getElementById('pause-until-date');
        const routinePausedInput = document.getElementById('routine-paused');
        const routinePauseUntilInput = document.getElementById('routine-pause-until');
        
        const isCurrentlyPaused = routinePausedInput.value === 'true';
        
        if (isCurrentlyPaused) {
            // Resume (set to active)
            pauseToggleBtn.textContent = '▶️ Active';
            pauseToggleBtn.className = 'px-5 py-3 border border-gray-300 rounded-md text-sm font-medium transition-colors bg-green-50 text-green-700 hover:bg-green-100';
            pauseUntilContainer.classList.add('hidden');
            routinePausedInput.value = 'false';
            routinePauseUntilInput.value = '';
        } else {
            // Pause
            pauseToggleBtn.textContent = '⏸️ Paused';
            pauseToggleBtn.className = 'px-5 py-3 border border-gray-300 rounded-md text-sm font-medium transition-colors bg-orange-50 text-orange-700 hover:bg-orange-100';
            pauseUntilContainer.classList.remove('hidden');
            routinePausedInput.value = 'true';
            
            // Don't automatically set a date - let user choose if they want one
            // Keep existing date if there was one, otherwise leave empty
            if (!pauseUntilDate.value) {
                routinePauseUntilInput.value = '';
            } else {
                routinePauseUntilInput.value = pauseUntilDate.value;
            }
        }
    }
    
    toggleCompletedVisibility() {
        const achievableCheckbox = document.getElementById('routine-achievable');
        const completedContainer = document.getElementById('routine-completed-container');
        const completedCheckbox = document.getElementById('routine-completed');
        
        if (achievableCheckbox.checked) {
            // Show completed checkbox when achievable is checked
            completedContainer.classList.remove('hidden');
        } else {
            // Hide completed checkbox and uncheck it when achievable is unchecked
            completedContainer.classList.add('hidden');
            completedCheckbox.checked = false;
            // Also re-enable status controls if they were disabled
            this.setStatusControlsEnabled(true);
        }
    }
    
    handleCompletedToggle() {
        const completedCheckbox = document.getElementById('routine-completed');
        
        if (completedCheckbox.checked) {
            // BIG CELEBRATION for routine completion! 🎉
            this.triggerRoutineCompletionCelebration();
            
            // Disable status controls when marked as completed
            this.setStatusControlsEnabled(false);
        } else {
            // Re-enable status controls when unchecked
            this.setStatusControlsEnabled(true);
        }
    }
    
    setStatusControlsEnabled(enabled) {
        const pauseToggleBtn = document.getElementById('pause-toggle-btn');
        const pauseUntilContainer = document.getElementById('pause-until-container');
        
        if (enabled) {
            pauseToggleBtn.disabled = false;
            pauseToggleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            pauseToggleBtn.classList.add('hover:bg-green-100');
        } else {
            pauseToggleBtn.disabled = true;
            pauseToggleBtn.classList.add('opacity-50', 'cursor-not-allowed');
            pauseToggleBtn.classList.remove('hover:bg-green-100');
            // Hide pause until container when disabled
            pauseUntilContainer.classList.add('hidden');
        }
    }
    
    async completeRoutine(routineId) {
        try {
            await this.apiCall(`/api/routines/${routineId}/complete`, {
                method: 'PUT'
            });
            await this.loadRoutines();
            this.loadRoutinesView();
        } catch (error) {
            console.error('Failed to complete routine:', error);
            this.showError('Failed to complete routine');
        }
    }
    
    async archiveRoutine(routineId) {
        try {
            await this.apiCall(`/api/routines/${routineId}/archive`, {
                method: 'PUT'
            });
            await this.loadRoutines();
            this.loadRoutinesView();
        } catch (error) {
            console.error('Failed to archive routine:', error);
            this.showError('Failed to archive routine');
        }
    }
    
    async deleteRoutine(routineId) {
        try {
            await this.apiCall(`/api/routines/${routineId}`, {
                method: 'DELETE'
            });
            await this.loadRoutines();
            this.loadRoutinesView();
        } catch (error) {
            console.error('Failed to delete routine:', error);
            this.showError('Failed to delete routine');
        }
    }
    
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, (m) => map[m]) : '';
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showError(message) {
        console.error(message);
        // TODO: Implement proper error notification
        alert(message);
    }
}

// Global functions removed - now using proper event listeners

// Initialize the app when DOM is loaded
let app;
console.log('🚀 CLIO Board app.js loaded - VERSION 4');
console.log('🚀 Current location:', window.location.href);

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM Content Loaded - initializing CLIO Board');
    app = new ClioBoardApp();
});

// Also try window.onload as backup
window.addEventListener('load', () => {
    if (!app) {
        console.log('🔄 Backup initialization via window.onload');
        app = new ClioBoardApp();
    }
});

// Export for debugging
window.clioApp = app;