import { useEffect, useState } from "react";

import objectConfig from "../config/objectConfig";


function RecordModal({
    mode,
    objectName,
    fields,
    record,
    onClose,
    onSave,
    saving
}) {

    const [formData, setFormData] = useState({});
    const [validationError, setValidationError] = useState("");


    const editableFields =
        objectConfig[objectName]?.fields || [];


    useEffect(() => {

        if (record) {

            const initialData = {};

            editableFields.forEach((field) => {

                initialData[field.name] =
                    record[field.name] ?? "";

            });

            setFormData(initialData);

        } else {

            setFormData({});
        }

        setValidationError("");

    }, [record, objectName]);


    function handleChange(fieldName, value) {

        setFormData((previousData) => ({
            ...previousData,
            [fieldName]: value
        }));


        if (validationError) {
            setValidationError("");
        }
    }


    function validateForm() {

        for (const field of editableFields) {

            if (
                field.required &&
                !String(formData[field.name] ?? "").trim()
            ) {

                return `${field.label} is required.`;
            }
        }


        if (
            formData.Email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                formData.Email
            )
        ) {

            return "Please enter a valid email address.";
        }


        if (
            formData.Website &&
            !/^https?:\/\/.+/i.test(
                formData.Website
            )
        ) {

            return "Website must start with http:// or https://.";
        }


        return "";
    }


    function handleSubmit(event) {

        event.preventDefault();


        const errorMessage = validateForm();


        if (errorMessage) {

            setValidationError(errorMessage);

            return;
        }


        /*
            Remove empty values so we don't
            unnecessarily send empty fields
            to Salesforce.
        */
        const cleanedData = {};


        editableFields.forEach((field) => {

            const value = formData[field.name];


            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {

                cleanedData[field.name] =
                    field.type === "number"
                        ? Number(value)
                        : value;
            }

        });


        onSave(cleanedData);
    }


    const title =
        mode === "create"
            ? `Create ${objectName}`
            : mode === "edit"
                ? `Edit ${objectName}`
                : `View ${objectName}`;


    return (
        <div className="modal-overlay">

            <div className="modal">

                <div className="modal-header">

                    <h2>{title}</h2>


                    <button
                        className="close-button"
                        onClick={onClose}
                        disabled={saving}
                    >
                        ×
                    </button>

                </div>


                {mode === "view" ? (

                    <div className="view-record">

                        {fields.map((field) => (

                            <div
                                className="view-field"
                                key={field}
                            >

                                <strong>
                                    {field}
                                </strong>

                                <span>
                                    {record?.[field] !== null &&
                                    record?.[field] !== undefined &&
                                    record?.[field] !== ""
                                        ? String(record[field])
                                        : "-"
                                    }
                                </span>

                            </div>

                        ))}

                    </div>

                ) : (

                    <form onSubmit={handleSubmit}>

                        {validationError && (

                            <div className="form-error">
                                {validationError}
                            </div>

                        )}


                        <div className="form-fields">

                            {editableFields.map((field) => (

                                <div
                                    className="form-field"
                                    key={field.name}
                                >

                                    <label htmlFor={field.name}>

                                        {field.label}

                                        {field.required && (
                                            <span className="required">
                                                *
                                            </span>
                                        )}

                                    </label>


                                    <input
                                        id={field.name}
                                        type={field.type}
                                        value={
                                            formData[field.name] ?? ""
                                        }
                                        onChange={(event) =>
                                            handleChange(
                                                field.name,
                                                event.target.value
                                            )
                                        }
                                        required={field.required}
                                        disabled={saving}
                                    />

                                </div>

                            ))}

                        </div>


                        <div className="modal-actions">

                            <button
                                type="button"
                                className="cancel-button"
                                onClick={onClose}
                                disabled={saving}
                            >
                                Cancel
                            </button>


                            <button
                                type="submit"
                                className="save-button"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : mode === "create"
                                        ? "Create"
                                        : "Save Changes"}
                            </button>

                        </div>

                    </form>

                )}

            </div>

        </div>
    );
}


export default RecordModal;