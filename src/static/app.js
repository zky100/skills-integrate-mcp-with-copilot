document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const userInfo = document.getElementById("user-info");
  const adminContainer = document.getElementById("admin-container");
  const signupContainer = document.getElementById("signup-container");
  const usernameDisplay = document.getElementById("username-display");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const sortBy = document.getElementById("sort-by");
  const resetFiltersBtn = document.getElementById("reset-filters");
  const addActivityForm = document.getElementById("add-activity-form");
  const toggleAddFormBtn = document.getElementById("toggle-add-form");
  const cancelAddFormBtn = document.getElementById("cancel-add-form");
  const cancelSignupBtn = document.getElementById("cancel-signup");
  const closeModalBtn = document.querySelector(".close");

  // Global state
  let allActivities = [];
  let currentUser = null;
  let isAdmin = false;

  // Load user from localStorage on page load
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    isAdmin = true;
    updateUIForLoggedInUser();
  }

  // Login modal handlers
  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
  });

  closeModalBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  window.addEventListener("click", (event) => {
    if (event.target == loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        currentUser = { username: result.username };
        isAdmin = true;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        loginMessage.textContent = "Login successful!";
        loginMessage.className = "success";
        loginForm.reset();
        updateUIForLoggedInUser();
        setTimeout(() => {
          loginModal.classList.add("hidden");
        }, 1000);
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
      }
      loginMessage.classList.remove("hidden");
    } catch (error) {
      loginMessage.textContent = "Error logging in";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Login error:", error);
    }
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    currentUser = null;
    isAdmin = false;
    localStorage.removeItem("currentUser");
    updateUIForLoggedOut();
    fetchActivities();
  });

  // Update UI based on login status
  function updateUIForLoggedInUser() {
    loginBtn.classList.add("hidden");
    userInfo.classList.remove("hidden");
    usernameDisplay.textContent = `Logged in as: ${currentUser.username}`;
    adminContainer.classList.remove("hidden");
    signupContainer.classList.remove("hidden");
  }

  function updateUIForLoggedOut() {
    loginBtn.classList.remove("hidden");
    userInfo.classList.add("hidden");
    adminContainer.classList.add("hidden");
    signupContainer.classList.add("hidden");
  }

  // Populate categories
  async function populateCategories() {
    try {
      const response = await fetch("/activities/categories");
      const data = await response.json();
      data.categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent =
          category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  // Fetch activities with filters
  async function fetchActivities() {
    try {
      const params = new URLSearchParams();
      const searchTerm = searchInput.value;
      const categoryValue = categoryFilter.value;
      const sortValue = sortBy.value;

      if (searchTerm) params.append("search", searchTerm);
      if (categoryValue) params.append("category", categoryValue);
      params.append("sort_by", sortValue);

      const response = await fetch(`/activities?${params.toString()}`);
      const activities = await response.json();

      allActivities = activities;
      displayActivities(activities);
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Display activities
  function displayActivities(activities) {
    activitiesList.innerHTML = "";

    if (activities.length === 0) {
      activitiesList.innerHTML = "<p>No activities found.</p>";
      return;
    }

    activities.forEach((activity) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft =
        activity.max_participants - activity.participants.length;
      const isFull = spotsLeft <= 0;

      // Create participants HTML
      const participantsHTML =
        activity.participants.length > 0
          ? `<div class="participants-section">
            <h5>Participants (${activity.participants.length}/${activity.max_participants}):</h5>
            <ul class="participants-list">
              ${activity.participants
                .map(
                  (email) =>
                    `<li>
                      <span class="participant-email">${email}</span>
                      ${
                        isAdmin
                          ? `<button class="delete-btn" data-activity="${activity.name}" data-email="${email}">❌</button>`
                          : ""
                      }
                    </li>`
                )
                .join("")}
            </ul>
          </div>`
          : `<p><em>No participants yet</em></p>`;

      const deleteButtonHTML =
        isAdmin && !isFull
          ? `<button class="activity-delete-btn" data-activity="${activity.name}">Delete Activity</button>`
          : "";

      activityCard.innerHTML = `
        <h4>${activity.name}</h4>
        <p>${activity.description}</p>
        <p><strong>Schedule:</strong> ${activity.schedule}</p>
        <p><strong>Category:</strong> ${
        activity.category.charAt(0).toUpperCase() + activity.category.slice(1)
      }</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
        ${deleteButtonHTML}
      `;

      activitiesList.appendChild(activityCard);

      // Add delete button listeners
      if (isAdmin) {
        const deleteBtn = activityCard.querySelector(".activity-delete-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", () =>
            handleDeleteActivity(activity.name)
          );
        }

        const deleteParticipantBtns = activityCard.querySelectorAll(
          ".delete-btn"
        );
        deleteParticipantBtns.forEach((btn) => {
          btn.addEventListener("click", handleUnregister);
        });
      }

      // Add to dropdown
      if (isAdmin) {
        const existingOption = Array.from(activitySelect.options).find(
          (opt) => opt.value === activity.name
        );
        if (!existingOption) {
          const option = document.createElement("option");
          option.value = activity.name;
          option.textContent = activity.name;
          activitySelect.appendChild(option);
        }
      }
    });
  }

  // Handle unregister
  async function handleUnregister(event) {
    event.preventDefault();
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!currentUser) {
      messageDiv.textContent = "Must be logged in as teacher";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(
          email
        )}&admin_username=${currentUser.username}&admin_password=${
          JSON.parse(localStorage.getItem("currentUser")).password || ""
        }`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "Error unregistering";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Unregister error:", error);
    }
  }

  // Handle signup
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      messageDiv.textContent = "Must be logged in as teacher";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    // This would need admin password - for now store it
    const storedUser = JSON.parse(localStorage.getItem("currentUser"));

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            is_admin: true,
            admin_username: currentUser.username,
            admin_password: storedUser.password || "",
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "Error signing up";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Signup error:", error);
    }
  });

  // Add Activity form
  toggleAddFormBtn.addEventListener("click", () => {
    addActivityForm.classList.toggle("hidden");
  });

  cancelAddFormBtn.addEventListener("click", () => {
    addActivityForm.classList.add("hidden");
    addActivityForm.reset();
  });

  addActivityForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      messageDiv.textContent = "Must be logged in as teacher";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const name = document.getElementById("activity-name").value;
    const description = document.getElementById("activity-description").value;
    const schedule = document.getElementById("activity-schedule").value;
    const maxParticipants = parseInt(
      document.getElementById("activity-max").value
    );
    const category = document.getElementById("activity-category").value;

    const storedUser = JSON.parse(localStorage.getItem("currentUser"));

    try {
      const response = await fetch(
        `/activities/add?admin_username=${currentUser.username}&admin_password=${
          storedUser.password || ""
        }`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            schedule,
            max_participants: maxParticipants,
            category,
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        addActivityForm.reset();
        addActivityForm.classList.add("hidden");
        fetchActivities();
        populateCategories();
      } else {
        messageDiv.textContent = result.detail || "Error adding activity";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to add activity";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Add activity error:", error);
    }
  });

  // Handle delete activity
  async function handleDeleteActivity(activityName) {
    if (!confirm(`Are you sure you want to delete "${activityName}"?`)) return;

    if (!currentUser) {
      messageDiv.textContent = "Must be logged in as teacher";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("currentUser"));

    try {
      const response = await fetch(
        `/activities/delete/${encodeURIComponent(
          activityName
        )}?admin_username=${currentUser.username}&admin_password=${
          storedUser.password || ""
        }`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "Error deleting activity";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to delete activity";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Delete activity error:", error);
    }
  }

  // Filter event listeners
  searchInput.addEventListener("input", fetchActivities);
  categoryFilter.addEventListener("change", fetchActivities);
  sortBy.addEventListener("change", fetchActivities);
  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "";
    sortBy.value = "name";
    fetchActivities();
  });

  cancelSignupBtn.addEventListener("click", () => {
    signupForm.reset();
  });

  // Initialize
  populateCategories();
  fetchActivities();
});

