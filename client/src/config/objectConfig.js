const objectConfig = {
    Account: {
        fields: [
            {
                name: "Name",
                label: "Account Name",
                type: "text",
                required: true
            },
            {
                name: "Phone",
                label: "Phone",
                type: "tel",
                required: false
            },
            {
                name: "Website",
                label: "Website",
                type: "url",
                required: false
            },
            {
                name: "Industry",
                label: "Industry",
                type: "text",
                required: false
            },
            {
                name: "Type",
                label: "Type",
                type: "text",
                required: false
            }
        ]
    },


    Opportunity: {
        fields: [
            {
                name: "Name",
                label: "Opportunity Name",
                type: "text",
                required: true
            },
            {
                name: "Amount",
                label: "Amount",
                type: "number",
                required: false
            },
            {
                name: "StageName",
                label: "Stage",
                type: "text",
                required: true
            },
            {
                name: "CloseDate",
                label: "Close Date",
                type: "date",
                required: true
            }
        ]
    },


    Lead: {
        fields: [
            {
                name: "FirstName",
                label: "First Name",
                type: "text",
                required: false
            },
            {
                name: "LastName",
                label: "Last Name",
                type: "text",
                required: true
            },
            {
                name: "Company",
                label: "Company",
                type: "text",
                required: true
            },
            {
                name: "Email",
                label: "Email",
                type: "email",
                required: false
            },
            {
                name: "Phone",
                label: "Phone",
                type: "tel",
                required: false
            },
            {
                name: "Status",
                label: "Status",
                type: "text",
                required: true
            }
        ]
    },


    Contact: {
        fields: [
            {
                name: "FirstName",
                label: "First Name",
                type: "text",
                required: false
            },
            {
                name: "LastName",
                label: "Last Name",
                type: "text",
                required: true
            },
            {
                name: "Email",
                label: "Email",
                type: "email",
                required: false
            },
            {
                name: "Phone",
                label: "Phone",
                type: "tel",
                required: false
            },
            {
                name: "AccountId",
                label: "Account ID",
                type: "text",
                required: false
            }
        ]
    },


    Case: {
        fields: [
            {
                name: "Subject",
                label: "Subject",
                type: "text",
                required: false
            },
            {
                name: "Status",
                label: "Status",
                type: "text",
                required: true
            },
            {
                name: "Priority",
                label: "Priority",
                type: "text",
                required: false
            },
            {
                name: "Origin",
                label: "Origin",
                type: "text",
                required: false
            }
        ]
    }
};


export default objectConfig;