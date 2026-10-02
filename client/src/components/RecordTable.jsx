function RecordTable({
    fields,
    records,
    onView,
    onEdit,
    onDelete
}) {

    if (!records || records.length === 0) {

        return (
            <div className="empty-message">
                No records found.
            </div>
        );
    }


    return (
        <div className="table-container">

            <table className="record-table">

                <thead>

                    <tr>

                        {fields.map((field) => (

                            <th key={field}>
                                {field}
                            </th>

                        ))}

                        <th>
                            Actions
                        </th>

                    </tr>

                </thead>


                <tbody>

                    {records.map((record) => (

                        <tr key={record.Id}>

                            {fields.map((field) => (

                                <td key={field}>

                                    {record[field] !== null &&
                                    record[field] !== undefined &&
                                    record[field] !== ""
                                        ? String(record[field])
                                        : "-"
                                    }

                                </td>

                            ))}


                            <td className="action-cell">

                                <button
                                    className="view-button"
                                    onClick={() =>
                                        onView(record.Id)
                                    }
                                >
                                    View
                                </button>


                                <button
                                    className="edit-button"
                                    onClick={() =>
                                        onEdit(record)
                                    }
                                >
                                    Edit
                                </button>


                                <button
                                    className="delete-button"
                                    onClick={() =>
                                        onDelete(record.Id)
                                    }
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>
    );
}


export default RecordTable;