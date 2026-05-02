            <button className="secondary-button" type="button" onClick={shareDashboard}>
              <Share2 size={17} />
              Share
            </button>
            {taskStore.requiresLogin && (
              <button className="secondary-button" type="button" onClick={handleSignOut}>
                <LogOut size={17} />
                Sign Out
              </button>
            )}
            <button className="primary-button" type="button" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={20} />
              New Task
            </button>
          </div>
        </header>

        <section className="stats-grid" aria-label="Task stats">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong className={stat.color}>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="controls" aria-label="Task controls">
          <label className="search-box">
            <Search size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks by title..."
            />
          </label>
          <div className="filter-row" role="group" aria-label="Filter tasks">
            {['All', 'To Do', 'In Progress', 'Done'].map((filter) => (
              <button
                className={activeFilter === filter ? 'filter-button active' : 'filter-button'}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="loading-panel">Loading tasks...</div>
        ) : (
          <section className="board" aria-label="Task board">
            {Object.entries(columnConfig).map(([status, config]) => {
              const Icon = config.icon;
              const columnTasks = filteredTasks
                .filter((task) => task.status === status)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

              return (
                <div className={`column ${config.style}`} key={status}>
                  <div className="column-header">
                    <div>
                      <Icon size={20} />
                      <h2>{config.label}</h2>
                    </div>
                    <span>{columnTasks.length}</span>
                  </div>

                  <div className="task-list">
                    {columnTasks.map((task) => (
                      <article className="task-card" key={task.id}>
                        <div className="task-topline">
                          <span className={`priority ${priorityStyles[task.priority] || priorityStyles.Medium}`}>
                            {task.priority}
                          </span>
                          <button
                            className="icon-button delete-button"
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            aria-label={`Delete ${task.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <h3>{task.title}</h3>
                        {task.description && <p>{task.description}</p>}

                        <div className="task-footer">
                          <button
                            className="icon-button"
                            disabled={status === 'todo'}
                            onClick={() => moveTask(task.id, status, 'prev')}
                            type="button"
                            aria-label={`Move ${task.title} back`}
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <span>{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Today'}</span>
                          <button
                            className="icon-button"
                            disabled={status === 'done'}
                            onClick={() => moveTask(task.id, status, 'next')}
                            type="button"
                            aria-label={`Move ${task.title} forward`}
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </article>
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="empty-state">
                        <AlertCircle size={38} />
                        <span>Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {isAddModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
            <div className="modal-header">
              <h2 id="create-task-title">Create New Task</h2>
              <button className="icon-button" onClick={() => setIsAddModalOpen(false)} type="button">
                <X size={24} />
              </button>
            </div>

            <form className="task-form" onSubmit={handleAddTask}>
              <label>
                <span>Task Title</span>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="Review the design system..."
                  value={newTask.title}
                  onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                />
              </label>

              <label>
                <span>Context</span>
                <textarea
                  placeholder="Describe the objective..."
                  rows="3"
                  value={newTask.description}
                  onChange={(event) => setNewTask({ ...newTask, description: event.target.value })}
                />
              </label>

              <div className="form-grid">
                <label>
                  <span>Priority</span>
                  <select
                    value={newTask.priority}
                    onChange={(event) => setNewTask({ ...newTask, priority: event.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={newTask.status}
                    onChange={(event) => setNewTask({ ...newTask, status: event.target.value })}
                  >
                    <option value="todo">To Do</option>
                    <option value="progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
              </div>

              <div className="form-actions">
                <button className="text-button" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Deploy Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
