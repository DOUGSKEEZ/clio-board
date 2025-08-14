// CLIO Board Frontend Application
// API Integration and Dynamic Task Management

class ClioBoardApp {
    constructor() {
        console.log('🏗️ ClioBoardApp constructor called');
        this.tasks = [];
        this.routines = [];
        this.archivedTasks = [];
        this.apiUrl = window.location.origin;
        this.sortables = {};
        this.expandedLists = new Set(); // Track which lists are expanded
        this.currentView = 'tasks'; // Track current view
        this.currentRoutine = null; // Track current routine for detail view
        
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
        const url = `${this.apiUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        console.log(`🌐 API Call: ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error ${response.status}:`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        // Handle empty responses (like DELETE 204)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            console.log(`✅ API Response: No content (${response.status})`);
            return null;
        }
        
        const data = await response.json();
        console.log(`✅ API Response: ${Array.isArray(data) ? data.length + ' items' : 'object'}`);
        return data;
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

    async moveTask(taskId, newColumn) {
        console.log(`🔄 Moving task ${taskId} to ${newColumn}`);
        const updatedTask = await this.apiCall(`/api/tasks/${taskId}/move`, {
            method: 'PUT',
            body: JSON.stringify({ column: newColumn })
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
    }

    createTaskCard(task) {
        const div = document.createElement('div');
        const routineInfo = task.routine_id ? 
            this.routines.find(r => r.id === task.routine_id) : null;
        const isPaused = routineInfo && routineInfo.status === 'paused';
        
        div.className = `task-card ${isPaused ? 'bg-gray-200 opacity-90' : 'bg-white'} rounded-lg p-2 shadow-sm card-transition cursor-pointer border border-gray-200 hover:border-blue-400 hover:border-2 hover:shadow-md group`;
        div.setAttribute('data-task-id', task.id);
        div.setAttribute('data-task-type', task.type);
        
        const dueDate = task.due_date ? 
            new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
        
        div.innerHTML = `
            <div class="flex items-start justify-between mb-1">
                <div class="flex items-center flex-1 relative">
                    <button class="task-complete-btn absolute left-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 hover:border-green-500 hover:shadow-sm ${task.status === 'completed' ? 'opacity-100 bg-green-500 border-green-500' : 'opacity-0 group-hover:opacity-100 border-gray-300'}" data-task-id="${task.id}">
                        ${task.status === 'completed' ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
                    </button>
                    <h3 class="text-sm font-medium leading-snug flex-1 transition-all duration-200 ${task.status === 'completed' ? 'text-gray-500 line-through ml-6' : isPaused ? 'text-gray-500 group-hover:ml-6' : 'text-gray-900 group-hover:ml-6'}">${this.escapeHtml(task.title)}</h3>
                </div>
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
            
            ${task.type === 'list' && task.items && task.items.length > 0 ? this.renderListItems(task.items, task, isPaused) : ''}
            
            <div class="flex items-center justify-between mt-2">
                ${this.renderRoutineTag(routineInfo)}
                <div class="flex items-center space-x-2 text-xs text-gray-500">
                    ${task.type === 'list' ? this.renderListStatus(task.items) : ''}
                    ${dueDate ? `<span><i class="fas fa-calendar mr-1"></i>${dueDate}</span>` : ''}
                </div>
            </div>
        `;
        
        // Add click handlers
        div.addEventListener('click', (e) => this.handleTaskClick(e, task));
        
        // Add completion button handler
        const completeBtn = div.querySelector('.task-complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task edit modal
                this.handleTaskToggle(task.id, task.status === 'completed' ? 'pending' : 'completed');
            });
        }

        // Add menu button handler
        const menuBtn = div.querySelector('.task-menu-btn');
        const menu = div.querySelector('.task-menu');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task edit modal
                
                // Close any other open menus
                document.querySelectorAll('.task-menu').forEach(m => {
                    if (m !== menu) m.classList.add('hidden');
                });
                
                // Toggle this menu
                menu.classList.toggle('hidden');
            });
        }

        // Add archive button handler (in dropdown menu)
        const archiveBtn = div.querySelector('.archive-task-btn');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task edit modal
                this.handleTaskArchive(task.id);
                // Close the menu after action
                const menu = div.querySelector('.task-menu');
                if (menu) menu.classList.add('hidden');
            });
        }
        
        // Add checkbox event listeners for list items
        const checkboxes = div.querySelectorAll('.list-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation(); // Prevent task click
                const taskId = checkbox.dataset.taskId;
                const itemId = checkbox.dataset.itemId;
                this.handleItemToggle(e, taskId, itemId);
            });
        });

        // Add expand/collapse event listeners
        const expandBtn = div.querySelector('.expand-btn');
        const collapseBtn = div.querySelector('.collapse-btn');
        const hiddenItems = div.querySelector('.hidden-items');

        if (expandBtn && collapseBtn && hiddenItems) {
            // Check if this list should be expanded on render
            const isExpanded = this.expandedLists.has(task.id);
            if (isExpanded) {
                hiddenItems.classList.remove('hidden');
                expandBtn.classList.add('hidden');
                collapseBtn.classList.remove('hidden');
            }

            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task click
                this.expandedLists.add(task.id); // Track expanded state
                hiddenItems.classList.remove('hidden');
                expandBtn.classList.add('hidden');
                collapseBtn.classList.remove('hidden');
                
                // Add event listeners to newly shown checkboxes
                const newCheckboxes = hiddenItems.querySelectorAll('.list-item-checkbox');
                newCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        e.stopPropagation();
                        const taskId = checkbox.dataset.taskId;
                        const itemId = checkbox.dataset.itemId;
                        this.handleItemToggle(e, taskId, itemId);
                    });
                });
            });

            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task click
                this.expandedLists.delete(task.id); // Remove from expanded state
                hiddenItems.classList.add('hidden');
                expandBtn.classList.remove('hidden');
                collapseBtn.classList.add('hidden');
            });
        }
        
        return div;
    }

    renderListItems(items, task, isPaused = false) {
        if (!items || items.length === 0) return '';
        
        const visibleItems = items.slice(0, 4);
        const hiddenItems = items.slice(4);
        const hasMore = hiddenItems.length > 0;
        
        const visibleItemsHtml = visibleItems.map(item => `
            <div class="flex items-center space-x-2 text-xs">
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="w-3 h-3 text-green-600 list-item-checkbox ${isPaused ? 'opacity-40' : ''}" 
                       ${isPaused ? 'style="accent-color: #d1d5db; background-color: #d1d5db !important; -webkit-appearance: none; appearance: none; border: 1px solid #9ca3af; border-radius: 3px;"' : ''}
                       data-task-id="${task.id}"
                       data-item-id="${item.id}">
                <span class="${item.completed ? 'line-through text-gray-500' : isPaused ? 'text-gray-500' : 'text-gray-700'}">${this.escapeHtml(item.title)}</span>
            </div>
        `).join('');
        
        const hiddenItemsHtml = hiddenItems.map(item => `
            <div class="flex items-center space-x-2 text-xs">
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="w-3 h-3 text-green-600 list-item-checkbox ${isPaused ? 'opacity-40' : ''}" 
                       ${isPaused ? 'style="accent-color: #d1d5db; background-color: #d1d5db !important; -webkit-appearance: none; appearance: none; border: 1px solid #9ca3af; border-radius: 3px;"' : ''}
                       data-task-id="${task.id}"
                       data-item-id="${item.id}">
                <span class="${item.completed ? 'line-through text-gray-500' : isPaused ? 'text-gray-500' : 'text-gray-700'}">${this.escapeHtml(item.title)}</span>
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
        
        return `
            <div class="list-items space-y-1 mb-2 p-2 ${isPaused ? 'bg-gray-100 opacity-75' : 'bg-gray-50'} rounded" data-list-container="${task.id}">
                <div class="visible-items">
                    ${visibleItemsHtml}
                </div>
                <div class="hidden-items hidden">
                    ${hiddenItemsHtml}
                </div>
                ${expandButton}
                ${collapseButton}
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
            return `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">☐ No routine</span>`;
        }
        
        const isPaused = routine.status === 'paused';
        
        if (isPaused) {
            return `
                <span class="routine-tag text-gray-600 bg-gray-100 opacity-80">
                    ${routine.icon} ${this.escapeHtml(routine.title)}
                </span>
            `;
        }
        
        return `
            <span class="routine-tag text-white" style="background-color: ${routine.color}">
                ${routine.icon} ${this.escapeHtml(routine.title)}
            </span>
        `;
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
                this.closeAddTaskModal();
                this.closeEditTaskModal();
                this.closeArchiveModal();
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
                const newStatus = this.editingTask.status === 'completed' ? 'pending' : 'completed';
                this.handleTaskToggle(this.editingTask.id, newStatus);
                // Update the editing task status so UI updates immediately
                this.editingTask.status = newStatus;
                // Update the modal UI
                this.updateEditModalCompletionUI(newStatus);
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
    }

    handleTaskClick(event, task) {
        // Prevent handling if clicking on interactive elements
        if (event.target.type === 'checkbox' || event.target.closest('button')) {
            return;
        }
        
        console.log('Task clicked:', task.title);
        this.openEditTaskModal(task);
    }

    async handleItemToggle(event, taskId, itemId) {
        event.stopPropagation();
        const completed = event.target.checked;
        
        try {
            await this.toggleItemComplete(taskId, itemId, completed);
            // Refresh the specific task's data
            await this.loadTasks();
            this.renderBoard();
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
            
            // Refresh board to show updated status
            await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error('Failed to toggle task completion:', error);
            this.showError('Failed to update task');
        }
    }

    async handleTaskArchive(taskId) {
        try {
            console.log(`📦 Archiving task ${taskId}`);
            
            await this.apiCall(`/api/tasks/${taskId}/archive`, {
                method: 'PUT'
            });
            
            // Refresh board to remove archived task
            await this.loadTasks();
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
    openAddTaskModal(defaultColumn = 'today') {
        const modal = document.getElementById('add-task-modal');
        const columnSelect = document.getElementById('task-column');
        
        // Store the selected column for use when submitting
        this.selectedColumn = defaultColumn;
        columnSelect.value = defaultColumn;
        
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
            const columnNames = {
                'today': 'Today',
                'tomorrow': 'Tomorrow', 
                'this_week': 'This Week',
                'horizon': 'On the Horizon'
            };
            modalTitle.innerHTML = `Add Task - <strong>${columnNames[defaultColumn] || 'Today'}</strong>`;
        }
        
        // Load routine options
        this.populateRoutineDropdown('task-routine');
        
        modal.classList.remove('hidden');
        document.getElementById('task-title').focus();
    }

    addListItemField(autoFocus = true) {
        const container = document.getElementById('list-items-container');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center space-x-2';
        
        const itemId = `list-item-${Date.now()}`;
        itemDiv.innerHTML = `
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
        
        // Handle tab navigation
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

    async populateRoutineDropdown(selectElementId, selectedRoutineId = null) {
        try {
            const select = document.getElementById(selectElementId);
            if (!select) return;
            
            // Clear existing options except "No routine"
            select.innerHTML = '<option value="">No routine</option>';
            
            // Get active and paused routines (exclude completed and archived)
            const routines = await this.apiCall('/api/routines');
            const availableRoutines = routines.filter(routine => 
                !routine.is_archived && 
                (routine.status === 'active' || routine.status === 'paused')
            );
            
            availableRoutines.forEach(routine => {
                const option = document.createElement('option');
                option.value = routine.id;
                
                // Create option text with icon and name
                const icon = routine.icon || '⭐';
                option.textContent = `${icon} ${routine.title}`;
                
                // Set style for the option (though this is limited in select elements)
                if (routine.color && routine.color.startsWith('#')) {
                    option.style.color = routine.color;
                }
                
                // Mark as selected if this is the current routine
                if (selectedRoutineId && routine.id === selectedRoutineId) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading routines for dropdown:', error);
        }
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
        
        // Load routine options and set current selection
        this.populateRoutineDropdown('edit-task-routine', task.routine_id);
        
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
        
        this.archivedRoutines.forEach(routine => {
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
        
        this.archivedTasks.forEach(task => {
            const taskElement = this.createArchivedTaskCard(task);
            container.appendChild(taskElement);
        });
    }

    createArchivedRoutineCard(routine) {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded-lg p-3 border border-gray-200';
        
        const archivedDate = new Date(routine.archived_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
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
                        <span>Archived ${archivedDate}</span>
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
            
        const archivedDate = new Date(task.archived_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        div.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                    <h3 class="text-sm font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}">${this.escapeHtml(task.title)}</h3>
                    <div class="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                        <span>Archived ${archivedDate}</span>
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
            task.items.forEach(item => {
                this.addEditListItemField(item);
            });
        }
        
        // Always add an empty field at the bottom for new items
        this.addEditListItemField(null, false); // Don't auto-focus the empty field
    }

    addEditListItemField(existingItem = null, autoFocus = true) {
        const container = document.getElementById('edit-list-items-container');
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center space-x-2';
        
        const itemId = existingItem ? existingItem.id : `new-item-${Date.now()}`;
        const isCompleted = existingItem ? existingItem.completed : false;
        const itemTitle = existingItem ? existingItem.title : '';
        
        itemDiv.innerHTML = `
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
            
            // Handle tab navigation
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
                const checkbox = input.parentElement.querySelector('input[type="checkbox"]');
                const isCompleted = checkbox.checked;
                
                if (itemTitle) {
                    if (itemId.startsWith('new-item-')) {
                        // Add new item
                        await this.apiCall(`/api/tasks/${this.editingTask.id}/items`, {
                            method: 'POST',
                            body: JSON.stringify({ title: itemTitle })
                        });
                    } else {
                        // Update existing item
                        await this.apiCall(`/api/tasks/${this.editingTask.id}/items/${itemId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ 
                                title: itemTitle,
                                completed: isCompleted 
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
            
            // Reload tasks to get updated data
            await this.loadTasks();
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
                onEnd: (evt) => this.handleDragEnd(evt)
            });
            
            this.sortables[column] = sortable;
        });
        
        console.log('✅ Drag-and-drop initialized');
    }

    async handleDragEnd(evt) {
        const taskId = evt.item.getAttribute('data-task-id');
        const newColumn = evt.to.closest('[data-column]').getAttribute('data-column');
        
        if (!taskId || !newColumn) return;
        
        try {
            await this.moveTask(taskId, newColumn);
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
            green: 'bg-green-100 text-green-700',
            purple: 'bg-purple-100 text-purple-700',
            orange: 'bg-orange-100 text-orange-700',
            red: 'bg-red-100 text-red-700',
            yellow: 'bg-yellow-100 text-yellow-700',
            pink: 'bg-pink-100 text-pink-700',
            gray: 'bg-gray-100 text-gray-700',
            indigo: 'bg-indigo-100 text-indigo-700',
            teal: 'bg-teal-100 text-teal-700',
            lime: 'bg-lime-100 text-lime-700',
            rose: 'bg-rose-100 text-rose-700'
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
        const colorClass = colorMap[colorName] || colorMap.blue;
        
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
                        ${!routine.paused_until ? 
                            `<button class="pause-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                                <i class="fas fa-pause text-xs mr-2"></i>Pause
                            </button>` :
                            `<button class="resume-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                                <i class="fas fa-play text-xs mr-2"></i>Resume
                            </button>`
                        }
                        ${routine.achievable && !routine.completed ? 
                            `<button class="complete-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                                <i class="fas fa-check text-xs mr-2"></i>Complete
                            </button>` : ''
                        }
                        <button class="archive-routine-btn w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" data-routine-id="${routine.id}">
                            <i class="fas fa-archive text-xs mr-2"></i>Archive
                        </button>
                        <div class="border-t border-gray-200"></div>
                        <button class="delete-routine-btn w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50" data-routine-id="${routine.id}">
                            <i class="fas fa-trash text-xs mr-2"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-3 truncate min-h-[1.25rem]">${routine.description ? this.escapeHtml(routine.description) : ''}</p>
            <div class="relative flex items-center justify-between">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}">
                    ${(parseInt(routine.pending_tasks || 0) + parseInt(routine.completed_tasks || 0))} tasks
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
        
        const deleteBtn = div.querySelector('.delete-routine-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${routine.name}"? This cannot be undone.`)) {
                    await this.deleteRoutine(routine.id);
                    menu.classList.add('hidden');
                }
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
                if (['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink', 'gray', 'indigo', 'teal', 'lime', 'rose'].includes(routine.color)) {
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
        
        countElement.textContent = `${tasks.length} tasks`;
        
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No tasks found for this routine.</p>';
            return;
        }
        
        container.innerHTML = '';
        tasks.forEach(task => {
            const div = document.createElement('div');
            div.className = 'bg-white rounded-lg p-3 border border-gray-200 hover:shadow-sm transition-shadow';
            
            const statusIcon = task.status === 'completed' ? '✅' : '📋';
            const dueDate = task.due_date ? 
                new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="text-sm">${statusIcon}</span>
                        <span class="text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}">${this.escapeHtml(task.title)}</span>
                        <span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">${task.column_name || task.column}</span>
                    </div>
                    <div class="flex items-center space-x-2 text-xs text-gray-500">
                        ${dueDate ? `<span><i class="fas fa-calendar mr-1"></i>${dueDate}</span>` : ''}
                        ${task.type === 'list' ? '<span><i class="fas fa-list mr-1"></i>List</span>' : ''}
                    </div>
                </div>
            `;
            
            container.appendChild(div);
        });
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
        } catch (error) {
            console.error('Failed to pause routine:', error);
            this.showError('Failed to pause routine');
        }
    }
    
    async resumeRoutine(routineId) {
        try {
            // Resume by setting paused_until to null
            await this.apiCall(`/api/routines/${routineId}/pause`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume: true })
            });
            await this.loadRoutines();
            this.loadRoutinesView();
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