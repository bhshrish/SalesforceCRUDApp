import { useEffect, useRef, useState } from "react";

import ObjectSelector from "./components/ObjectSelector";
import RecordTable from "./components/RecordTable";
import RecordModal from "./components/RecordModal";

function App() {
    const [authenticated, setAuthenticated] =
        useState(null);

    const [selectedObject, setSelectedObject] =
        useState("Account");

    const [fields, setFields] =
        useState([]);

    const [records, setRecords] =
        useState([]);

    const [nextRecordsUrl, setNextRecordsUrl] =
        useState(null);

    const [loading, setLoading] =
        useState(false);

    const [loadingMore, setLoadingMore] =
        useState(false);

    const [error, setError] =
        useState("");

    const [modalMode, setModalMode] =
        useState(null);

    const [selectedRecord, setSelectedRecord] =
        useState(null);

    const [saving, setSaving] =
        useState(false);

    const [loggingOut, setLoggingOut] =
        useState(false);

    const loadingMoreRef =
        useRef(false);

    /*
        Check authentication status
    */
    async function checkAuthentication() {
        try {
            const response = await fetch(
                "http://localhost:5000/auth/status",
                {
                    credentials: "include"
                }
            );

            const data =
                await response.json();

            setAuthenticated(
                data.authenticated
            );
        } catch (error) {
            console.error(
                "Authentication check failed:",
                error
            );

            setAuthenticated(false);
        }
    }

    /*
        Check authentication when application starts
    */
    useEffect(() => {
        checkAuthentication();
    }, []);

    /*
        Fetch Salesforce records
    */
    async function fetchRecords(objectName) {
        try {
            setLoading(true);
            setError("");

            setRecords([]);
            setFields([]);
            setNextRecordsUrl(null);

            const response = await fetch(
                `http://localhost:5000/api/salesforce/${objectName}`,
                {
                    credentials: "include"
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to retrieve Salesforce records"
                );
            }

            setFields(
                data.fields || []
            );

            setRecords(
                data.records || []
            );

            setNextRecordsUrl(
                data.nextRecordsUrl ||
                null
            );
        } catch (error) {
            console.error(
                "Error fetching Salesforce records:",
                error
            );

            /*
                If the backend says the session
                is no longer valid, return to
                logged-out state.
            */
            if (
                error.message ===
                "Not authenticated with Salesforce"
            ) {
                setAuthenticated(false);
                return;
            }

            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    /*
        Load the next page of records
    */
    async function loadMoreRecords() {
        if (
            !nextRecordsUrl ||
            loadingMoreRef.current
        ) {
            return;
        }

        try {
            loadingMoreRef.current = true;
            setLoadingMore(true);
            setError("");

            const params =
                new URLSearchParams({
                    nextRecordsUrl
                });

            const response = await fetch(
                `http://localhost:5000/api/salesforce/${selectedObject}?${params.toString()}`,
                {
                    credentials: "include"
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to load more records"
                );
            }

            setRecords(
                (previousRecords) => [
                    ...previousRecords,
                    ...(data.records || [])
                ]
            );

            setNextRecordsUrl(
                data.nextRecordsUrl ||
                null
            );
        } catch (error) {
            console.error(
                "Pagination error:",
                error
            );

            setError(error.message);
        } finally {
            loadingMoreRef.current =
                false;

            setLoadingMore(false);
        }
    }

    /*
        Infinite scrolling
    */
    useEffect(() => {
        if (!authenticated) {
            return;
        }

        function handleScroll() {
            const scrollPosition =
                window.innerHeight +
                window.scrollY;

            const pageHeight =
                document.documentElement
                    .scrollHeight;

            if (
                scrollPosition >=
                pageHeight - 200
            ) {
                loadMoreRecords();
            }
        }

        window.addEventListener(
            "scroll",
            handleScroll
        );

        return () => {
            window.removeEventListener(
                "scroll",
                handleScroll
            );
        };
    }, [
        nextRecordsUrl,
        selectedObject,
        authenticated
    ]);

    /*
        Fetch records whenever
        the selected object changes
    */
    useEffect(() => {
        if (!authenticated) {
            return;
        }

        fetchRecords(
            selectedObject
        );
    }, [
        selectedObject,
        authenticated
    ]);

    /*
        Change Salesforce object
    */
    function handleObjectChange(
        objectName
    ) {
        setSelectedObject(
            objectName
        );

        setModalMode(null);
        setSelectedRecord(null);
        setError("");
    }

    /*
        View record
    */
    async function handleView(id) {
        try {
            setError("");

            const response = await fetch(
                `http://localhost:5000/api/salesforce/${selectedObject}/${id}`,
                {
                    credentials: "include"
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to retrieve record"
                );
            }

            setSelectedRecord(
                data.record
            );

            setModalMode("view");
        } catch (error) {
            console.error(
                "View record error:",
                error
            );

            setError(error.message);
        }
    }

    /*
        Open edit modal
    */
    function handleEdit(record) {
        setSelectedRecord(record);
        setModalMode("edit");
        setError("");
    }

    /*
        Open create modal
    */
    function handleCreate() {
        setSelectedRecord(null);
        setModalMode("create");
        setError("");
    }

    /*
        Save record
    */
    async function handleSave(
        formData
    ) {
        try {
            setSaving(true);
            setError("");

            let url;
            let method;

            if (
                modalMode === "create"
            ) {
                url =
                    `http://localhost:5000/api/salesforce/${selectedObject}`;

                method = "POST";
            } else {
                url =
                    `http://localhost:5000/api/salesforce/${selectedObject}/${selectedRecord.Id}`;

                method = "PATCH";
            }

            const response =
                await fetch(url, {
                    method,
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify(
                        formData
                    )
                });

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to save record"
                );
            }

            setModalMode(null);
            setSelectedRecord(null);

            await fetchRecords(
                selectedObject
            );
        } catch (error) {
            console.error(
                "Save record error:",
                error
            );

            setError(error.message);
        } finally {
            setSaving(false);
        }
    }

    /*
        Delete record
    */
    async function handleDelete(id) {
        const confirmed =
            window.confirm(
                `Are you sure you want to delete this ${selectedObject}?`
            );

        if (!confirmed) {
            return;
        }

        try {
            setError("");

            const response =
                await fetch(
                    `http://localhost:5000/api/salesforce/${selectedObject}/${id}`,
                    {
                        method: "DELETE",
                        credentials:
                            "include"
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to delete record"
                );
            }

            await fetchRecords(
                selectedObject
            );
        } catch (error) {
            console.error(
                "Delete record error:",
                error
            );

            setError(error.message);
        }
    }

    /*
        Close modal
    */
    function handleCloseModal() {
        if (saving) {
            return;
        }

        setModalMode(null);
        setSelectedRecord(null);
    }

    /*
        Logout
    */
    async function handleLogout() {
        try {
            setLoggingOut(true);
            setError("");

            const response =
                await fetch(
                    "http://localhost:5000/auth/logout",
                    {
                        credentials:
                            "include"
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Logout failed"
                );
            }

            /*
                Clear frontend state
            */
            setAuthenticated(false);

            setRecords([]);
            setFields([]);
            setNextRecordsUrl(null);
            setModalMode(null);
            setSelectedRecord(null);
        } catch (error) {
            console.error(
                "Logout error:",
                error
            );

            setError(
                error.message
            );
        } finally {
            setLoggingOut(false);
        }
    }

    /*
        Initial authentication check
    */
    if (authenticated === null) {
        return (
            <div className="auth-loading">
                <div className="auth-card">
                    <div className="spinner"></div>

                    <p>
                        Checking Salesforce
                        connection...
                    </p>
                </div>
            </div>
        );
    }

    /*
        Logged-out screen
    */
    if (!authenticated) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="salesforce-icon">
                        ☁
                    </div>

                    <h1>
                        Salesforce CRUD
                    </h1>

                    <p>
                        Connect your Salesforce
                        account to manage records.
                    </p>

                    <a
                        href="http://localhost:5000/auth/salesforce"
                        className="salesforce-login-button"
                    >
                        Login with Salesforce
                    </a>
                </div>
            </div>
        );
    }

    /*
        Logged-in application
    */
    return (
        <div className="app">
            <header className="app-header">
                <div>
                    <h1>
                        Salesforce CRUD
                        Application
                    </h1>

                    <p>
                        Manage Salesforce
                        records from one
                        interface
                    </p>
                </div>

                <button
                    className="logout-button"
                    onClick={
                        handleLogout
                    }
                    disabled={
                        loggingOut
                    }
                >
                    {loggingOut
                        ? "Logging out..."
                        : "Logout"}
                </button>
            </header>

            <main className="app-content">
                <div className="toolbar">
                    <ObjectSelector
                        selectedObject={
                            selectedObject
                        }
                        onObjectChange={
                            handleObjectChange
                        }
                    />

                    <button
                        className="create-button"
                        onClick={
                            handleCreate
                        }
                    >
                        + Add{" "}
                        {selectedObject}
                    </button>
                </div>

                {loading && (
                    <div className="loading-message">
                        Loading{" "}
                        {selectedObject}{" "}
                        records...
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {!loading &&
                    !error && (
                        <>
                            <RecordTable
                                fields={fields}
                                records={records}
                                onView={
                                    handleView
                                }
                                onEdit={
                                    handleEdit
                                }
                                onDelete={
                                    handleDelete
                                }
                            />

                            {loadingMore && (
                                <div className="loading-more">
                                    Loading more
                                    records...
                                </div>
                            )}

                            {!nextRecordsUrl &&
                                records.length >
                                    0 && (
                                    <div className="end-message">
                                        All records
                                        have been
                                        loaded.
                                    </div>
                                )}
                        </>
                    )}
            </main>

            {modalMode && (
                <RecordModal
                    mode={modalMode}
                    objectName={
                        selectedObject
                    }
                    fields={fields}
                    record={
                        selectedRecord
                    }
                    onClose={
                        handleCloseModal
                    }
                    onSave={
                        handleSave
                    }
                    saving={saving}
                />
            )}
        </div>
    );
}

export default App;