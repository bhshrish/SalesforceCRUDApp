function ObjectSelector({
    selectedObject,
    onObjectChange
}) {

    const objects = [
        "Account",
        "Opportunity",
        "Lead",
        "Contact",
        "Case"
    ];


    return (
        <div className="object-selector">

            <label htmlFor="salesforce-object">
                Select Salesforce Object
            </label>


            <select
                id="salesforce-object"
                value={selectedObject}
                onChange={(event) =>
                    onObjectChange(event.target.value)
                }
            >

                {objects.map((object) => (

                    <option
                        key={object}
                        value={object}
                    >
                        {object}
                    </option>

                ))}

            </select>

        </div>
    );
}


export default ObjectSelector;