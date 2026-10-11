
import { useEffect, useRef, useState } from "react";

import ObjectSelector from "./components/ObjectSelector";
import RecordTable from "./components/RecordTable";
import RecordModal from "./components/RecordModal";
import API_BASE_URL from "./config/api";

const PAGE_SIZE = 20;

function App() {
    const [authenticated, setAuthenticated] = useState(null);

    const [selectedObject, setSelectedObject] = useState("Account");
    const [fields, setFields] = useState([]);
    const [records, setRecords] = useState([]);

    const [page, setPage] = useState(1);
    const [nextRecordsUrl, setNextRecordsUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const [modalMode, setModalMode] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const requestIdRef = useRef(0);
    const loadingMoreRef = useRef(false);

    const currentPageRecords = records.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const hasPreviousPage = page > 1;

    const hasNextPage =
        records.length > page * PAGE_SIZE ||
        Boolean(nextRecordsUrl);

    async function checkAuthentication() {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/status`,
                { credentials: "include" }
            );

            const data = await response.json();

            setAuthenticated(Boolean(data.authenticated));
        } catch (err) {
            console.error("Authentication check failed:", err);
            setAuthenticated(false);
        }
    }

    useEffect(() => {
        checkAuthentication();
    }, []);

    async function fetchRecords(objectName) {
        const requestId = ++requestIdRef.current;

        loadingMoreRef.current = false;
        setLoadingMore(false);
        setLoading(true);
        setError("");

        setRecords([]);
        setFields([]);
        setNextRecordsUrl(null);
        setPage(1);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/salesforce/${objectName}`,
                { credentials: "include" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to retrieve Salesforce records"
                );
            }

            if (requestId !== requestIdRef.current) return;

            setFields(data.fields || []);
            setRecords(data.records || []);
            setNextRecordsUrl(data.nextRecordsUrl || null);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;

            console.error("Error fetching records:", err);

            if (
                err.message ===
                "Not authenticated with Salesforce"
            ) {
                setAuthenticated(false);
                return;
            }

            setError(err.message);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }

    useEffect(() => {
        if (!authenticated) return;

        fetchRecords(selectedObject);

        return () => {
            requestIdRef.current += 1;
        };
    }, [selectedObject, authenticated]);

    async function handleNextPage() {
        if (loading || loadingMoreRef.current) return;

        const nextPage = page + 1;

        // Navigate immediately if the next page is cached.
        if (records.length > page * PAGE_SIZE) {
            setPage(nextPage);
            return;
        }

        if (!nextRecordsUrl) return;

        const requestId = requestIdRef.current;
        const objectName = selectedObject;

        try {
            loadingMoreRef.current = true;
            setLoadingMore(true);
            setError("");

            const params = new URLSearchParams({
                nextRecordsUrl
            });

            const response = await fetch(
                `${API_BASE_URL}/api/salesforce/${objectName}?${params.toString()}`,
                { credentials: "include" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to load next page"
                );
            }

            if (requestId !== requestIdRef.current) return;

            const newRecords = data.records || [];

            setRecords((previous) => [
                ...previous,
                ...newRecords
            ]);

            setNextRecordsUrl(
                data.nextRecordsUrl || null
            );

            if (newRecords.length > 0) {
                setPage(nextPage);
            }
        } catch (err) {
            if (requestId !== requestIdRef.current) return;

            console.error("Pagination error:", err);
            setError(err.message);
        } finally {
            loadingMoreRef.current = false;

            if (requestId === requestIdRef.current) {
                setLoadingMore(false);
            }
        }
    }

    function handlePreviousPage() {
        if (page > 1 && !loadingMore) {
            setPage((previous) => previous - 1);
        }
    }

    function handleObjectChange(objectName) {
        if (objectName === selectedObject) return;

        setSelectedObject(objectName);
        setModalMode(null);
        setSelectedRecord(null);
        setError("");
    }

    async function handleView(id) {
        try {
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/salesforce/${selectedObject}/${id}`,
                { credentials: "include" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to retrieve record"
                );
            }

            setSelectedRecord(data.record);
            setModalMode("view");
        } catch (err) {
            console.error("View record error:", err);
            setError(err.message);
        }
    }

    function handleEdit(record) {
        setSelectedRecord(record);
        setModalMode("edit");
        setError("");
    }

    function handleCreate() {
        setSelectedRecord(null);
        setModalMode("create");
        setError("");
    }

    async function handleSave(formData) {
        try {
            setSaving(true);
            setError("");

            const isCreate = modalMode === "create";

            const url = isCreate
                ? `${API_BASE_URL}/api/salesforce/${selectedObject}`
                : `${API_BASE_URL}/api/salesforce/${selectedObject}/${selectedRecord.Id}`;

            const response = await fetch(url, {
                method: isCreate ? "POST" : "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to save record"
                );
            }

            setModalMode(null);
            setSelectedRecord(null);

            await fetchRecords(selectedObject);
        } catch (err) {
            console.error("Save record error:", err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        const confirmed = window.confirm(
            `Are you sure you want to delete this ${selectedObject}?`
        );

        if (!confirmed) return;

        try {
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/salesforce/${selectedObject}/${id}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to delete record"
                );
            }

            await fetchRecords(selectedObject);
        } catch (err) {
            console.error("Delete record error:", err);
            setError(err.message);
        }
    }

    function handleCloseModal() {
        if (saving) return;

        setModalMode(null);
        setSelectedRecord(null);
    }

    async function handleLogout() {
        try {
            setLoggingOut(true);
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/auth/logout`,
                { credentials: "include" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Logout failed"
                );
            }

            requestIdRef.current += 1;

            setAuthenticated(false);
            setRecords([]);
            setFields([]);
            setNextRecordsUrl(null);
            setPage(1);
            setModalMode(null);
            setSelectedRecord(null);
        } catch (err) {
            console.error("Logout error:", err);
            setError(err.message);
        } finally {
            setLoggingOut(false);
        }
    }

    if (authenticated === null) {
        return (
            <div className="auth-loading">
                <div className="auth-card">
                    <div className="spinner"></div>
                    <p>
                        Checking Salesforce connection...
                    </p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="salesforce-icon">
                        ☁
                    </div>

                    <h1>Salesforce CRUD</h1>

                    <p>
                        Connect your Salesforce account
                        to manage records.
                    </p>

                    <a
                        href={`${API_BASE_URL}/api/auth/salesforce`}
                        className="salesforce-login-button"
                    >
                        Login with Salesforce
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="app-header">
                <div>
                    <h1>
                        Salesforce CRUD Application
                    </h1>
                    <p>
                        Manage Salesforce records
                        from one interface
                    </p>
                </div>

                <button
                    className="logout-button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                >
                    {loggingOut
                        ? "Logging out..."
                        : "Logout"}
                </button>
            </header>

            <main className="app-content">
                <div className="toolbar">
                    <ObjectSelector
                        selectedObject={selectedObject}
                        onObjectChange={handleObjectChange}
                    />

                    <button
                        className="create-button"
                        onClick={handleCreate}
                    >
                        + Add {selectedObject}
                    </button>
                </div>

                {loading && (
                    <div className="loading-message">
                        Loading {selectedObject} records...
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {!loading && (
                    <>
                        <RecordTable
                            fields={fields}
                            records={currentPageRecords}
                            onView={handleView}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />

                        {(records.length > 0 ||
                            nextRecordsUrl) && (
                            <div className="pagination">
                                <button
                                    className="pagination-button"
                                    onClick={handlePreviousPage}
                                    disabled={
                                        !hasPreviousPage ||
                                        loadingMore
                                    }
                                >
                                    Previous
                                </button>

                                <span className="pagination-info">
                                    Page {page}
                                </span>

                                <button
                                    className="pagination-button"
                                    onClick={handleNextPage}
                                    disabled={
                                        !hasNextPage ||
                                        loadingMore
                                    }
                                >
                                    {loadingMore
                                        ? "Loading..."
                                        : "Next"}
                                </button>
                            </div>
                        )}

                        {records.length > 0 && (
                            <div className="end-message">
                                Showing{" "}
                                {(page - 1) * PAGE_SIZE + 1}
                                {" - "}
                                {(page - 1) * PAGE_SIZE +
                                    currentPageRecords.length}
                                {" records"}
                            </div>
                        )}
                    </>
                )}
            </main>

            {modalMode && (
                <RecordModal
                    mode={modalMode}
                    objectName={selectedObject}
                    fields={fields}
                    record={selectedRecord}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </div>
    );
}

export default App;
