function Board(app) {
    this.app = app;
    this.checkInterval = null;
}

Board.prototype.execute = function() {
    this.app.swimlane.refresh();
    this.app.swimlane.listen();
    this.restoreColumnViewMode();
    this.compactView();
    this.poll();
    this.keyboardShortcuts();
    this.resizeColumnHeight();
    this.listen();
    this.dragAndDrop();

    $(window).resize(this.resizeColumnHeight);
};

Board.prototype.poll = function() {
    var interval = parseInt($("#board").attr("data-check-interval"));

    if (interval > 0) {
        this.checkInterval = window.setInterval(this.check.bind(this), interval * 1000);
    }
};

Board.prototype.check = function() {
    if (this.app.isVisible()) {

        var self = this;
        this.app.showLoadingIcon();

        $.ajax({
            cache: false,
            url: $("#board").data("check-url"),
            statusCode: {
                200: function(data) { self.refresh(data); },
                304: function () { self.app.hideLoadingIcon(); }
            }
        });
    }
};

Board.prototype.save = function(taskId, columnId, position, swimlaneId) {
    this.app.showLoadingIcon();

    $.ajax({
        cache: false,
        url: $("#board").data("save-url"),
        contentType: "application/json",
        type: "POST",
        processData: false,
        data: JSON.stringify({
            "task_id": taskId,
            "column_id": columnId,
            "swimlane_id": swimlaneId,
            "position": position
        }),
        success: this.refresh.bind(this),
        error: this.app.hideLoadingIcon.bind(this)
    });
};

Board.prototype.refresh = function(data) {
    $("#board-container").replaceWith(data);

    this.app.refresh();
    this.app.swimlane.refresh();
    this.app.swimlane.listen();
    this.resizeColumnHeight();
    this.app.hideLoadingIcon();
    this.listen();
    this.dragAndDrop();
    this.compactView();
    this.restoreColumnViewMode();
};

Board.prototype.resizeColumnHeight = function() {
    var position = $(".board-swimlane").position();

    if (position) {
        $(".board-task-list").height($(window).height() - position.top);
    }
};

Board.prototype.dragAndDrop = function() {
    var self = this;
    $(".board-task-list").sortable({
        delay: 300,
        distance: 5,
        connectWith: ".board-task-list",
        placeholder: "draggable-placeholder",
        items: ".draggable-item",
        stop: function(event, ui) {
            self.save(
                ui.item.attr('data-task-id'),
                ui.item.parent().attr("data-column-id"),
                ui.item.index() + 1,
                ui.item.parent().attr('data-swimlane-id')
            );
        }
    });
};

Board.prototype.listen = function() {
    var self = this;

    $(document).on("click", ".task-board", function() {
        window.location = $(this).data("task-url");
    });

    $(document).on('click', ".filter-toggle-scrolling", function(e) {
        e.preventDefault();
        self.toggleCompactView();
    });

    $(document).on("click", ".board-column-title", function() {
        self.toggleColumnViewMode($(this).data("column-id"));
    });
};

Board.prototype.toggleCompactView = function() {
    var scrolling = localStorage.getItem("horizontal_scroll") || 1;
    localStorage.setItem("horizontal_scroll", scrolling == 0 ? 1 : 0);
    this.compactView();
};

Board.prototype.compactView = function() {
    if (localStorage.getItem("horizontal_scroll") == 0) {
        $(".filter-wide").show();
        $(".filter-compact").hide();

        $("#board-container").addClass("board-container-compact");
        $("#board th:not(.board-column-header-collapsed)").addClass("board-column-compact");
    }
    else {
        $(".filter-wide").hide();
        $(".filter-compact").show();

        $("#board-container").removeClass("board-container-compact");
        $("#board th").removeClass("board-column-compact");
    }
};

Board.prototype.toggleCollapsedMode = function() {
    var self = this;
    this.app.showLoadingIcon();

    $.ajax({
        cache: false,
        url: $('.filter-display-mode:not([style="display: none;"]) a').attr('href'),
        success: function(data) {
            $('.filter-display-mode').toggle();
            self.refresh(data);
        }
    });
};

Board.prototype.restoreColumnViewMode = function() {
    var self = this;

    $("tr:first th").each(function() {
        var columnId = $(this).data('column-id');
        if (localStorage.getItem("hidden_column_" + columnId)) {
            self.hideColumn(columnId);
        }
    });
};

Board.prototype.toggleColumnViewMode = function(columnId) {
    if (localStorage.getItem("hidden_column_" + columnId)) {
        this.showColumn(columnId);
    }
    else {
        this.hideColumn(columnId);
    }
};

Board.prototype.hideColumn = function(columnId) {
    $(".board-column-" + columnId + " .board-column-expanded").hide();
    $(".board-column-" + columnId + " .board-column-collapsed").show();
    $(".board-column-header-" + columnId + " .board-column-expanded").hide();
    $(".board-column-header-" + columnId + " .board-column-collapsed").show();

    $(".board-column-header-" + columnId).each(function() {
        $(this).removeClass("board-column-compact");
        $(this).addClass("board-column-header-collapsed");
    });

    $(".board-column-" + columnId ).each(function() {
        $(this).addClass("board-column-task-collapsed");
    });

    $(".board-column-" + columnId + " .board-rotation").each(function() {
        var position = $(".board-swimlane").position();
        $(".board-column-task-collapsed").height($(window).height() - position.top);
        $(this).css("width", $(".board-column-" + columnId + "").height());
    });

    localStorage.setItem("hidden_column_" + columnId, 1);
};

Board.prototype.showColumn = function(columnId) {
    $(".board-column-" + columnId + " .board-column-expanded").show();
    $(".board-column-" + columnId + " .board-column-collapsed").hide();
    $(".board-column-header-" + columnId + " .board-column-expanded").show();
    $(".board-column-header-" + columnId + " .board-column-collapsed").hide();

    $(".board-column-header-" + columnId).removeClass("board-column-header-collapsed");
    $(".board-column-" + columnId).removeClass("board-column-task-collapsed");

    if (localStorage.getItem("horizontal_scroll") == 0) {
        $(".board-column-header-" + columnId).addClass("board-column-compact");
    }

    localStorage.removeItem("hidden_column_" + columnId);
};

Board.prototype.keyboardShortcuts = function() {
    var self = this;

    Mousetrap.bind("c", function() { self.toggleCompactView(); });
    Mousetrap.bind("s", function() { self.toggleCollapsedMode(); });

    Mousetrap.bind("n", function() {
        self.app.popover.open($("#board").data("task-creation-url"));
    });
};
