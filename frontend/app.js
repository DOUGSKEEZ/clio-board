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
        div.className = 'task-card bg-white rounded-lg p-2 shadow-sm card-transition cursor-pointer border border-gray-200 hover:border-blue-400 hover:border-2 hover:shadow-md group';
        div.setAttribute('data-task-id', task.id);
        div.setAttribute('data-task-type', task.type);
        
        const routineInfo = task.routine_id ? 
            this.routines.find(r => r.id === task.routine_id) : null;
        
        const dueDate = task.due_date ? 
            new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
        
        div.innerHTML = `
            <div class="flex items-start justify-between mb-1">
                <div class="flex items-center flex-1 relative">
                    <button class="task-complete-btn absolute left-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 hover:border-green-500 hover:shadow-sm ${task.status === 'completed' ? 'opacity-100 bg-green-500 border-green-500' : 'opacity-0 group-hover:opacity-100 border-gray-300'}" data-task-id="${task.id}">
                        ${task.status === 'completed' ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
                    </button>
                    <h3 class="text-sm font-medium leading-snug flex-1 transition-all duration-200 ${task.status === 'completed' ? 'text-gray-500 line-through ml-6' : 'text-gray-900 group-hover:ml-6'}">${this.escapeHtml(task.title)}</h3>
                </div>
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
            </div>
            
            ${task.type === 'list' && task.items && task.items.length > 0 ? this.renderListItems(task.items, task) : ''}
            
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

    renderListItems(items, task) {
        if (!items || items.length === 0) return '';
        
        const visibleItems = items.slice(0, 4);
        const hiddenItems = items.slice(4);
        const hasMore = hiddenItems.length > 0;
        
        const visibleItemsHtml = visibleItems.map(item => `
            <div class="flex items-center space-x-2 text-xs">
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="w-3 h-3 text-green-600 list-item-checkbox" 
                       data-task-id="${task.id}"
                       data-item-id="${item.id}">
                <span class="${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}">${this.escapeHtml(item.title)}</span>
            </div>
        `).join('');
        
        const hiddenItemsHtml = hiddenItems.map(item => `
            <div class="flex items-center space-x-2 text-xs">
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="w-3 h-3 text-green-600 list-item-checkbox" 
                       data-task-id="${task.id}"
                       data-item-id="${item.id}">
                <span class="${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}">${this.escapeHtml(item.title)}</span>
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
            <div class="list-items space-y-1 mb-2 p-2 bg-gray-50 rounded" data-list-container="${task.id}">
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

        // Global click listener to close task menus when clicking outside
        document.addEventListener('click', (e) => {
            // Check if the click is outside any task menu or menu button
            const taskMenu = e.target.closest('.task-menu');
            const menuButton = e.target.closest('.task-menu-btn');
            
            if (!taskMenu && !menuButton) {
                // Close all open task menus
                document.querySelectorAll('.task-menu').forEach(menu => {
                    menu.classList.add('hidden');
                });
            }
        });
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
            
            // Refresh main board to show the restored task
            await this.loadTasks();
            this.renderBoard();
        } catch (error) {
            console.error('Failed to restore task:', error);
            this.showError('Failed to restore task');
        }
    }

    async loadArchivedTasks() {
        this.archivedTasks = await this.apiCall('/api/tasks/archived');
        console.log('📋 loadArchivedTasks() complete, received', this.archivedTasks.length, 'archived tasks');
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

    openArchiveModal() {
        const modal = document.getElementById('archive-modal');
        modal.classList.remove('hidden');
        this.loadArchivedTasks().then(() => {
            this.renderArchivedTasks();
        });
    }

    closeArchiveModal() {
        const modal = document.getElementById('archive-modal');
        modal.classList.add('hidden');
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
            due_date: document.getElementById('edit-task-due-date').value || null
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
            due_date: document.getElementById('task-due-date').value || null
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